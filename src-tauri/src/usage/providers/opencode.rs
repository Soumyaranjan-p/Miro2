//! OpenCode — reads the local SQLite store at
//! `~/.local/share/opencode/opencode.db` (verified on this machine: the
//! `session` table already aggregates `tokens_input/output/reasoning/
//! cache_read/cache_write` per session).
//!
//! The DB is large (1.3+ GB) and live, so the query walks the rowid index
//! backwards with a LIMIT instead of scanning, opens read-only, and sets a
//! busy timeout to coexist with the running tool.

use std::path::PathBuf;
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

use super::{calendar_windows, home_dir, AdapterOutput, Provider};

/// Recent sessions are what daily/weekly windows can ever see.
const ROW_LIMIT: i64 = 2_000;
const LOOKBACK_DAYS: i64 = 60;

pub struct Opencode;

impl Provider for Opencode {
    fn id(&self) -> &'static str {
        "opencode"
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
                present: true,
                windows: Vec::new(),
                past_maxima: Vec::new(),
            };
        };

        let (windows, past_maxima) = calendar_windows(&entries);
        AdapterOutput {
            present: true,
            windows,
            past_maxima,
        }
    }
}

fn db_path() -> Option<PathBuf> {
    home_dir().map(|home| home.join(".local").join("share").join("opencode").join("opencode.db"))
}

fn read_entries(path: &PathBuf) -> Option<Vec<(i64, u64)>> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    connection.busy_timeout(Duration::from_secs(2)).ok()?;

    let mut statement = connection
        .prepare(
            "SELECT time_created, tokens_input, tokens_output, tokens_reasoning,
                    tokens_cache_read, tokens_cache_write
             FROM session ORDER BY rowid DESC LIMIT ?",
        )
        .ok()?;

    let cutoff = chrono::Utc::now().timestamp_millis() - LOOKBACK_DAYS * 24 * 3_600_000;
    let mut rows = statement.query([ROW_LIMIT]).ok()?;

    let mut entries = Vec::new();
    while let Ok(Some(row)) = rows.next() {
        let timestamp = timestamp_ms(row.get(0).ok()?);
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

/// `time_created` is a drizzle column: either an RFC 3339 string or an epoch
/// number in milliseconds.
fn timestamp_ms(value: rusqlite::types::Value) -> Option<i64> {
    match value {
        rusqlite::types::Value::Integer(ms) => Some(ms),
        rusqlite::types::Value::Real(ms) => Some(ms as i64),
        rusqlite::types::Value::Text(text) => {
            chrono::DateTime::parse_from_rfc3339(&text).ok().map(|time| time.timestamp_millis())
        }
        _ => None,
    }
}

/// Depends on real data on this machine, so it is opt-in:
/// `cargo test -- --ignored --nocapture`.
#[test]
#[ignore]
fn reads_opencode_usage() {
    let output = Opencode.read();
    eprintln!("[opencode] present: {}", output.present);
    for (window, past_max) in output.windows.iter().zip(&output.past_maxima) {
        eprintln!(
            "[opencode] {} used={:?} past_max={:?}",
            window.label, window.used_tokens, past_max
        );
    }
}
