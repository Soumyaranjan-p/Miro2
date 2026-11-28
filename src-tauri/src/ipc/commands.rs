use tauri::{AppHandle, State};

use crate::app::notch::NotchRuntime;
use crate::media::{MediaCommand, MediaRuntime};
use crate::usage::{store, UsageRuntime};

use super::types::{default_snapshot, AppSnapshot, NotchState, UsageSettings};

#[tauri::command]
pub fn notch_state(runtime: State<'_, NotchRuntime>) -> NotchState {
    NotchState {
        phase: runtime.phase(),
    }
}

/// The frontend's first read. Everything the app does not persist yet comes
/// back as a sensible empty state rather than demo data.
#[tauri::command]
pub fn app_snapshot(runtime: State<'_, NotchRuntime>) -> AppSnapshot {
    default_snapshot(runtime.phase())
}

/// Frontend → YouTube: play/pause/next/previous via SMTC, seek via guarded
/// arrow keys (see media.rs). Best-effort; the next poll reports reality.
#[tauri::command]
pub fn media_control(
    runtime: State<'_, MediaRuntime>,
    action: String,
    target_ms: Option<u64>,
) -> Result<(), String> {
    let command = match action.as_str() {
        "toggle" => MediaCommand::Toggle,
        "play" => MediaCommand::Play,
        "pause" => MediaCommand::Pause,
        "next" => MediaCommand::Next,
        "previous" => MediaCommand::Previous,
        "seek" => MediaCommand::Seek(target_ms.unwrap_or(0)),
        other => return Err(format!("unknown media action: {other}")),
    };
    runtime.send(command)
}

#[tauri::command]
pub fn usage_settings_get(runtime: State<'_, UsageRuntime>) -> UsageSettings {
    runtime.settings.lock().expect("settings mutex").clone()
}

#[tauri::command]
pub fn usage_settings_set(
    app: AppHandle,
    runtime: State<'_, UsageRuntime>,
    settings: UsageSettings,
) -> Result<(), String> {
    store::save(&app, &settings)?;
    *runtime.settings.lock().expect("settings mutex") = settings;
    Ok(())
}
