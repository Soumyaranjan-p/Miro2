//! Zcode — reads the local activity DB at
//! `~/.zcode/cli/db/db.sqlite` (verified on this machine: the `turn_usage`
//! table carries per-turn `input_tokens, output_tokens, reasoning_tokens,
//! cache_creation_input_tokens, cache_read_input_tokens` with `started_at`).
//!
//! The DB is small (single-digit MB), so a bounded recent scan is cheap.

use std::path::PathBuf;
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

use super::{calendar_windows, home_dir, AdapterOutput, Provider};

const ROW_LIMIT: i64 = 20_000;
const LOOKBACK_DAYS: i64 = 60;

pub struct Zcode;

impl Provider for Zcode {
    fn id(&self) -> &'static str {
        "zcode"
    }

    fn detect(&self) -> bool {
        db_path().is_some_and(|path| path.is_file())
    }

    fn read(&self) -> AdapterOutput {
        let Some(path) = db_path() else {
            return AdapterOutput::default();
        };
        let Some(entries) = read_entries(&path) else {
            return AdapterOutput {
                windows: Vec::new(),
                past_maxima: Vec::new(),
            };
        };

        let (windows, past_maxima) = calendar_windows(&entries);
        AdapterOutput {
            windows,
            past_maxima,
        }
    }
}

fn db_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".zcode").join("cli").join("db").join("db.sqlite"))
}

fn read_entries(path: &PathBuf) -> Option<Vec<(i64, u64)>> {
    let connection =
        Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    connection.busy_timeout(Duration::from_secs(2)).ok()?;

    let mut statement = connection
        .prepare(
            "SELECT started_at, input_tokens, output_tokens, reasoning_tokens,
                    cache_creation_input_tokens, cache_read_input_tokens
             FROM turn_usage ORDER BY rowid DESC LIMIT ?",
        )
        .ok()?;

    let cutoff = chrono::Utc::now().timestamp_millis() - LOOKBACK_DAYS * 24 * 3_600_000;
    let mut rows = statement.query([ROW_LIMIT]).ok()?;

    let mut entries = Vec::new();
    while let Ok(Some(row)) = rows.next() {
        let started_at: rusqlite::types::Value = row.get(0).ok()?;
        let timestamp = match &started_at {
            rusqlite::types::Value::Integer(ms) => Some(*ms),
            rusqlite::types::Value::Real(ms) => Some(*ms as i64),
            rusqlite::types::Value::Text(text) => chrono::DateTime::parse_from_rfc3339(text)
                .ok()
                .map(|time| time.timestamp_millis()),
            _ => None,
        };
        let tokens: u64 = row.get::<_, i64>(1).ok()?.max(0) as u64
            + row.get::<_, i64>(2).ok()?.max(0) as u64
            + row.get::<_, i64>(3).ok()?.max(0) as u64
            + row.get::<_, i64>(4).ok()?.max(0) as u64
            + row.get::<_, i64>(5).ok()?.max(0) as u64;
        if timestamp.is_some_and(|ms| ms >= cutoff) && tokens > 0 {
            entries.push((timestamp.unwrap(), tokens));
        }
    }
    Some(entries)
}

/// Depends on real data on this machine, so it is opt-in:
/// `cargo test -- --ignored --nocapture`.
#[test]
#[ignore]
fn reads_zcode_usage() {
    let output = Zcode.read();
    eprintln!("[zcode] present: {}", output.present);
    for (window, past_max) in output.windows.iter().zip(&output.past_maxima) {
        eprintln!(
            "[zcode] {} used={:?} past_max={:?}",
            window.label, window.used_tokens, past_max
        );
    }
}
