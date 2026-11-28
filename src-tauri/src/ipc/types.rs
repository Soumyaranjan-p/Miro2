use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::app::hover::NotchPhase;

#[derive(Clone, Serialize)]
pub struct NotchState {
    pub phase: NotchPhase,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotchSnapshot {
    pub phase: NotchPhase,
    pub page: String,
    pub pages_order: Vec<String>,
    pub pages_hidden: Vec<String>,
    pub minimal: bool,
    pub show_clock_date: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsState {
    pub theme: String,
    pub language: String,
    pub start_with_windows: bool,
    pub hide_on_fullscreen: bool,
    pub expand_delay_ms: u64,
    pub collapse_delay_ms: u64,
}

/// Mirrors `MediaState` in `src/ipc/types.ts` field for field.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    pub session_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: u64,
    pub position_ms: u64,
    pub playing: bool,
    pub artwork_url: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub at_ms: u64,
    pub text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsState {
    pub track_key: Option<String>,
    pub status: String,
    pub lines: Vec<LyricLine>,
    pub active_index: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusState {
    pub running: bool,
    pub kind: String,
    pub round: u32,
    pub rounds_total: u32,
    pub remaining_ms: u64,
    pub total_ms: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaterEntry {
    pub at_ms: u64,
    pub ml: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaterState {
    pub goal_ml: u32,
    pub bottle_ml: u32,
    pub today_ml: u32,
    pub entries: Vec<WaterEntry>,
    pub active_from: String,
    pub active_to: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelfItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size_bytes: Option<u64>,
    pub added_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub due_at: Option<u64>,
}

/// Mirrors `AppSnapshot` in `src/ipc/types.ts`.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub version: u8,
    pub notch: NotchSnapshot,
    pub settings: SettingsState,
    pub media: Option<MediaState>,
    pub lyrics: LyricsState,
    pub focus: FocusState,
    pub water: WaterState,
    pub shelf: Vec<ShelfItem>,
    pub todo: Vec<TodoItem>,
}

const PAGES: [&str; 7] = [
    "music",
    "usage",
    "focus",
    "water",
    "shelf",
    "todo",
    "settings",
];

/// The first snapshot the frontend asks for. Everything the app does not
/// persist yet starts from a sensible, empty state — no demo data in a real
/// build.
pub fn default_snapshot(phase: NotchPhase) -> AppSnapshot {
    AppSnapshot {
        version: 1,
        notch: NotchSnapshot {
            phase,
            page: String::from("music"),
            pages_order: PAGES.iter().map(|page| String::from(*page)).collect(),
            pages_hidden: Vec::new(),
            minimal: false,
            show_clock_date: true,
        },
        settings: SettingsState {
            theme: String::from("system"),
            language: String::from("en"),
            start_with_windows: false,
            hide_on_fullscreen: true,
            expand_delay_ms: 140,
            collapse_delay_ms: 320,
        },
        media: None,
        lyrics: LyricsState {
            track_key: None,
            status: String::from("idle"),
            lines: Vec::new(),
            active_index: 0,
        },
        focus: FocusState {
            running: false,
            kind: String::from("focus"),
            round: 1,
            rounds_total: 4,
            remaining_ms: 25 * 60_000,
            total_ms: 25 * 60_000,
        },
        water: WaterState {
            goal_ml: 2_000,
            bottle_ml: 500,
            today_ml: 0,
            entries: Vec::new(),
            active_from: String::from("08:00"),
            active_to: String::from("22:00"),
        },
        shelf: Vec::new(),
        todo: Vec::new(),
    }
}

/// One measured window of a provider ("Current session", "Today", ...).
/// Mirrors `UsageWindow` in `src/ipc/types.ts`.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub label: String,
    pub used: u64,
    pub limit: u64,
    pub percent: f64,
    /// RFC 3339 local time; empty when the window never resets.
    pub resets_at: String,
}

/// Mirrors `ProviderUsage` in `src/ipc/types.ts`.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsage {
    pub id: String,
    /// The tool's local data exists on this machine. Read by the frontend,
    /// which decides whether a ring shows at all.
    #[allow(dead_code)]
    pub present: bool,
    /// The user enabled it in the dock settings.
    #[allow(dead_code)]
    pub enabled: bool,
    pub windows: Vec<UsageWindow>,
}

/// Mirrors `UsageState` in `src/ipc/types.ts`.
#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageState {
    pub providers: Vec<ProviderUsage>,
}

/// Per-provider dock settings. Mirrors `ProviderSetting` in `src/ipc/types.ts`.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProviderSetting {
    pub enabled: bool,
    pub limit_override: Option<u64>,
}

impl Default for ProviderSetting {
    fn default() -> Self {
        Self {
            enabled: true,
            limit_override: None,
        }
    }
}

/// Mirrors `UsageSettings` in `src/ipc/types.ts`.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UsageSettings {
    pub providers: HashMap<String, ProviderSetting>,
}

impl Default for UsageSettings {
    fn default() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }
}

impl UsageSettings {
    pub fn provider(&self, id: &str) -> ProviderSetting {
        self.providers.get(id).cloned().unwrap_or_default()
    }
}
