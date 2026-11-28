//! Claude Code — reads local session transcripts under
//! `~/.claude/projects/**/*.jsonl`. Only token totals are kept: each
//! assistant line carries `message.usage` counters, duplicated across
//! resume/studio chains, so lines are deduped on (message.id, requestId).
//!
//! Windows follow Claude's real cadence: a "Current session" is a 5-hour
//! block that starts at the first message; "All models" is the calendar
//! week (resets Monday 00:00 local).

use std::collections::HashSet;
use std::time::Duration;

use serde_json::Value;

use super::{
    collect_jsonl, home_dir, timestamp_to_ms, week_start_ms, AdapterOutput, Provider, WindowSample,
};

/// Token windows are the last 5 hours; files older than this cannot matter.
const FILE_MAX_AGE_DAYS: i64 = 8;
const BLOCK_MS: i64 = 5 * 60 * 60 * 1000;
const WEEK_MS: i64 = 7 * 24 * 60 * 60 * 1000;

pub struct Claude;

impl Provider for Claude {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn detect(&self) -> bool {
        home_dir()
            .map(|home| home.join(".claude").join("projects").is_dir())
            .unwrap_or(false)
    }

    fn read(&self) -> AdapterOutput {
        let Some(home) = home_dir() else {
            return AdapterOutput::default();
        };

        let mut files = Vec::new();
        collect_jsonl(
            &home.join(".claude").join("projects"),
            Duration::from_secs(FILE_MAX_AGE_DAYS as u64 * 86_400),
            &mut files,
        );

        let mut seen = HashSet::new();
        let mut entries: Vec<(i64, u64)> = Vec::new();

        for file in files {
            let Ok(content) = std::fs::read_to_string(&file) else {
                continue;
            };

            for line in content.lines() {
                let Ok(value) = serde_json::from_str::<Value>(line) else {
                    continue;
                };
                if value.get("type").and_then(Value::as_str) != Some("assistant") {
                    continue;
                }
                let Some(message) = value.get("message") else {
                    continue;
                };
                let Some(usage) = message.get("usage") else {
                    continue;
                };
                let Some(id) = message.get("id").and_then(Value::as_str) else {
                    continue;
                };
                let request = value
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if !seen.insert((id.to_string(), request.to_string())) {
                    continue;
                }

                let tokens = [
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                ]
                .iter()
                .map(|field| usage.get(*field).and_then(Value::as_u64).unwrap_or(0))
                .sum();
                let Some(timestamp) = value.get("timestamp").and_then(timestamp_to_ms) else {
                    continue;
                };
                entries.push((timestamp, tokens));
            }
        }

        entries.sort_by_key(|entry| entry.0);

        // Fold the timeline into 5-hour blocks; a block owns every entry
        // until the next one would start past its end.
        let mut blocks: Vec<(i64, u64)> = Vec::new();
        for (timestamp, tokens) in &entries {
            match blocks.last_mut() {
                Some(block) if *timestamp < block.0 + BLOCK_MS => block.1 += tokens,
                _ => blocks.push((*timestamp, *tokens)),
            }
        }

        let now = chrono::Utc::now().timestamp_millis();
        let current = blocks
            .last()
            .filter(|block| now < block.0 + BLOCK_MS)
            .copied();
        let closed_max = blocks
            .iter()
            .take(blocks.len().saturating_sub(1))
            .map(|block| block.1)
            .max();

        let week_start = week_start_ms(now);
        let mut week_buckets: std::collections::HashMap<i64, u64> = std::collections::HashMap::new();
        for (timestamp, tokens) in &entries {
            *week_buckets.entry(week_start_ms(*timestamp)).or_default() += tokens;
        }
        let week_used = week_buckets.get(&week_start).copied().unwrap_or(0);
        let past_week_max = week_buckets
            .iter()
            .filter(|(bucket, _)| **bucket != week_start)
            .map(|(_, total)| *total)
            .max();

        let (session_used, session_reset) = current
            .map(|(start, total)| (total, start + BLOCK_MS))
            .unwrap_or((0, 0));

        AdapterOutput {
            present: true,
            windows: vec![
                WindowSample {
                    label: String::from("Current session"),
                    used_tokens: Some(session_used),
                    direct_percent: None,
                    resets_at_ms: if session_reset > now {
                        Some(session_reset)
                    } else {
                        None
                    },
                },
                WindowSample {
                    label: String::from("All models"),
                    used_tokens: Some(week_used),
                    direct_percent: None,
                    resets_at_ms: Some(week_start + WEEK_MS),
                },
            ],
            past_maxima: vec![closed_max, past_week_max],
        }
    }
}

/// Depends on real sessions on this machine, so it is opt-in:
/// `cargo test -- --ignored --nocapture`.
#[test]
#[ignore]
fn reads_claude_usage() {
    let output = Claude.read();
    eprintln!("[claude] present: {}", output.present);
    for (window, past_max) in output.windows.iter().zip(&output.past_maxima) {
        eprintln!(
            "[claude] {} used={:?} past_max={:?}",
            window.label, window.used_tokens, past_max
        );
    }
}
