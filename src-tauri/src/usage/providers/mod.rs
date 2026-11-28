//! One adapter per provider. Each reads only its tool's local data — no
//! login, no network — and reports usage windows. Nothing here ever uploads
//! or logs file content; only token totals cross the boundary.

pub mod claude;
pub mod codex;
pub mod opencode;
pub mod zcode;

use std::path::{Path, PathBuf};
use std::time::Duration;

/// One measured window straight from the source. `percent` is set only when
/// the provider publishes a rate-limit percentage itself (Codex); otherwise
/// the orchestrator divides `used_tokens` by the configured limit.
#[derive(Clone, Debug, Default)]
pub struct WindowSample {
    pub label: String,
    pub used_tokens: Option<u64>,
    pub direct_percent: Option<f64>,
    /// Epoch milliseconds when the window resets; None = unknown.
    pub resets_at_ms: Option<i64>,
}

#[derive(Clone, Debug, Default)]
pub struct AdapterOutput {
    pub present: bool,
    pub windows: Vec<WindowSample>,
    /// Same length as `windows`: the highest past-window total, used as the
    /// default limit when the user has not set an override.
    pub past_maxima: Vec<Option<u64>>,
}

pub trait Provider: Send + Sync {
    fn id(&self) -> &'static str;
    /// Whether the tool's local data exists on this machine.
    fn detect(&self) -> bool;
    /// Read the usage windows. Must be cheap enough for a 60s cadence and
    /// must never panic on odd files — bad lines are skipped, not fatal.
    fn read(&self) -> AdapterOutput;
}

pub fn all() -> Vec<Box<dyn Provider>> {
    vec![
        Box::new(claude::Claude),
        Box::new(codex::Codex),
        Box::new(opencode::Opencode),
        Box::new(zcode::Zcode),
    ]
}

pub fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// Recursively collect *.jsonl files under `root`, skipping anything older
/// than `max_age` so huge histories stay cheap to walk.
pub fn collect_jsonl(root: &Path, max_age: Duration, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl(&path, max_age, out);
        } else if path.extension().is_some_and(|ext| ext == "jsonl") {
            let fresh = entry
                .metadata()
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age <= max_age);
            if fresh {
                out.push(path);
            }
        }
    }
}

/// Parse a JSON value as an epoch-milliseconds timestamp. Handles RFC 3339
/// strings, integer milliseconds, and integer/floating seconds.
pub fn timestamp_to_ms(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::String(text) => chrono::DateTime::parse_from_rfc3339(text)
            .ok()
            .map(|time| time.timestamp_millis()),
        serde_json::Value::Number(number) => {
            let millis = if let Some(ms) = number.as_i64() {
                // 1e12 ms ≈ 2001-09; anything smaller is seconds.
                if ms > 1_000_000_000_000 {
                    Some(ms)
                } else {
                    ms.checked_mul(1000)
                }
            } else {
                number
                    .as_f64()
                    .map(|seconds| (seconds * 1000.0) as i64)
                    .filter(|ms| *ms > 1_000_000_000_000)
            };
            millis
        }
        _ => None,
    }
}

/// Format epoch milliseconds as a local RFC 3339 stamp for the frontend.
pub fn ms_to_rfc3339(millis: i64) -> String {
    chrono::DateTime::from_timestamp_millis(millis)
        .map(|utc| utc.with_timezone(&chrono::Local).to_rfc3339())
        .unwrap_or_default()
}

/// Local midnight of the day containing `now_ms`, in epoch millis.
pub fn day_start_ms(now_ms: i64) -> i64 {
    boundary_ms(now_ms, |date| date)
}

/// Local Monday 00:00 of the week containing `now_ms`, in epoch millis.
pub fn week_start_ms(now_ms: i64) -> i64 {
    boundary_ms(now_ms, |date| {
        use chrono::Datelike;
        date - chrono::Duration::days(date.weekday().num_days_from_monday() as i64)
    })
}

fn boundary_ms(now_ms: i64, shift: impl Fn(chrono::NaiveDate) -> chrono::NaiveDate) -> i64 {
    use chrono::TimeZone;
    let local = match chrono::Local.timestamp_millis_opt(now_ms) {
        chrono::LocalResult::Single(time) => time,
        _ => chrono::Local::now(),
    };
    let boundary = shift(local.date_naive())
        .and_hms_opt(0, 0, 0)
        .and_then(|midnight| chrono::Local.from_local_datetime(&midnight).single());
    boundary
        .map(|time| time.timestamp_millis())
        .unwrap_or(now_ms)
}

/// Today / This week windows over a `(timestamp_ms, tokens)` log, plus the
/// highest past day and past week totals for default limits. This is the
/// shared shape for tools that have no rate-limit concept of their own.
pub fn calendar_windows(entries: &[(i64, u64)]) -> (Vec<WindowSample>, Vec<Option<u64>>) {
    const DAY_MS: i64 = 24 * 60 * 60 * 1000;
    const WEEK_MS: i64 = 7 * DAY_MS;

    let now = chrono::Utc::now().timestamp_millis();
    let day = day_start_ms(now);
    let week = week_start_ms(now);

    let mut day_buckets: std::collections::HashMap<i64, u64> = std::collections::HashMap::new();
    let mut week_buckets: std::collections::HashMap<i64, u64> = std::collections::HashMap::new();
    for (timestamp, tokens) in entries {
        *day_buckets.entry(day_start_ms(*timestamp)).or_default() += tokens;
        *week_buckets.entry(week_start_ms(*timestamp)).or_default() += tokens;
    }

    let today = day_buckets.get(&day).copied().unwrap_or(0);
    let this_week = week_buckets.get(&week).copied().unwrap_or(0);
    let past_day_max = day_buckets
        .iter()
        .filter(|(bucket, _)| **bucket != day)
        .map(|(_, total)| *total)
        .max();
    let past_week_max = week_buckets
        .iter()
        .filter(|(bucket, _)| **bucket != week)
        .map(|(_, total)| *total)
        .max();

    (
        vec![
            WindowSample {
                label: String::from("Today"),
                used_tokens: Some(today),
                direct_percent: None,
                resets_at_ms: Some(day + DAY_MS),
            },
            WindowSample {
                label: String::from("This week"),
                used_tokens: Some(this_week),
                direct_percent: None,
                resets_at_ms: Some(week + WEEK_MS),
            },
        ],
        vec![past_day_max, past_week_max],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rfc3339_numbers_and_strings() {
        let value = serde_json::Value::String(String::from("2026-11-27T12:00:00Z"));
        let ms = timestamp_to_ms(&value).expect("string timestamp");
        assert_eq!(ms, 1_792_862_400_000);

        let seconds = serde_json::Value::Number(1_792_862_400u64.into());
        assert_eq!(timestamp_to_ms(&seconds), Some(1_792_862_400_000));

        let millis = serde_json::Value::Number(1_792_862_400_123i64.into());
        assert_eq!(timestamp_to_ms(&millis), Some(1_792_862_400_123));
    }
}
