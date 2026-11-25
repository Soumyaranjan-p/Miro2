use tauri::State;

use crate::app::notch::NotchRuntime;

use super::types::NotchState;

#[tauri::command]
pub fn notch_state(runtime: State<'_, NotchRuntime>) -> NotchState {
    NotchState {
        phase: runtime.phase(),
    }
}
