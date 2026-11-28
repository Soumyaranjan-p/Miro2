//! Codex — reads local rollout files under `~/.codex/sessions/**/*.jsonl`.
//!
//! The rollout format is not verified on this machine (the user does not
//! actively use Codex), so this adapter is deliberately conservative: it
//! looks for `token_count` events that carry provider rate-limit
//! percentages (`rate_limits.primary` / `.secondary`, each with
//! `used_percent` and reset info) and uses them directly. Anything it
//! cannot confidently parse is skipped — a wrong number is worse than no
//! number. If the folders exist but nothing parses, the provider reports
//! present-but-empty and the dock hides the ring.

use std::time::Duration;

use serde_json::Value;

use super::{collect_jsonl, home_dir, AdapterOutput, Provider, WindowSample};

const FILE_MAX_AGE_DAYS: i64 = 8;

pub struct Codex;

impl Provider for Codex {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn detect(&self) -> bool {
        home_dir()
            .map(|home| home.join(".codex").join("sessions").is_dir())
            .unwrap_or(false)
    }

    fn read(&self) -> AdapterOutput {
        let Some(home) = home_dir() else {
            return AdapterOutput::default();
        };

        let mut files = Vec::new();
        collect_jsonl(
            &home.join(".codex").join("sessions"),
            Duration::from_secs(FILE_MAX_AGE_DAYS as u64 * 86_400),
            &mut files,
        );
        // Most recent last, so later files win when both carry a snapshot.
        files.sort();

        let mut primary: Option<(f64, Option<i64>)> = None;
        let mut secondary: Option<(f64, Option<i64>)> = None;

        for file in files {
            let Ok(content) = std::fs::read_to_string(&file) else {
                continue;
            };

            for line in content.lines() {
                let Ok(value) = serde_json::from_str::<Value>(line) else {
                    continue;
                };
                let Some(limits) = find_key(&value, "rate_limits") else {
                    continue;
                };

                if let Some((percent, reset)) = bucket(&limits, "primary") {
                    primary = Some((percent, reset));
                }
                if let Some((percent, reset)) = bucket(&limits, "secondary") {
                    secondary = Some((percent, reset));
                }
            }
        }

        let mut windows = Vec::new();
        let mut past_maxima = Vec::new();
        for (label, bucket) in [("Current session", primary), ("All models", secondary)] {
            if let Some((percent, reset)) = bucket {
                windows.push(WindowSample {
                    label: String::from(label),
                    used_tokens: None,
                    direct_percent: Some(percent),
                    resets_at_ms: reset,
                });
                past_maxima.push(None);
            }
        }

        AdapterOutput {
            present: true,
            windows,
            past_maxima,
        }
    }
}

/// Read one rate-limit bucket: `{ used_percent, resets_in_seconds? }`.
fn bucket(limits: &Value, name: &str) -> Option<(f64, Option<i64>)> {
    let bucket = limits.get(name)?;
    let percent = bucket.get("used_percent").and_then(Value::as_f64)?;
    let reset = bucket
        .get("resets_in_seconds")
        .and_then(Value::as_i64)
        .map(|seconds| chrono::Utc::now().timestamp_millis() + seconds * 1000);
    Some((percent, reset))
}

/// Depth-limited recursive key search — rollout payloads nest event data a
/// couple of levels deep and the exact shape varies between versions.
fn find_key<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }
            map.values().find_map(|child| find_key(child, key))
        }
        Value::Array(items) => items.iter().find_map(|item| find_key(item, key)),
        _ => None,
    }
}

/// Depends on real sessions on this machine, so it is opt-in:
/// `cargo test -- --ignored --nocapture`.
#[test]
#[ignore]
fn reads_codex_usage() {
    let output = Codex.read();
    eprintln!("[codex] present: {}", output.present);
    for window in &output.windows {
        eprintln!(
            "[codex] {} percent={:?}",
            window.label, window.direct_percent
        );
    }
}
