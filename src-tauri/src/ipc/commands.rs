use tauri::State;

use crate::app::notch::NotchRuntime;

use super::types::{default_snapshot, AppSnapshot, NotchState};

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
