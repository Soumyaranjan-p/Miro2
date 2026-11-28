//! The usage dock orchestrator.
//!
//! One thread reads every enabled provider's local data once a minute and
//! publishes `usage:update` to the dock window; another polls the cursor so
//! the always-on-top window stays click-through everywhere except over the
//! rings, an open popover, or the settings panel (the official Tauri dock
//! pattern — transparent WebView2 areas would otherwise swallow clicks).
//! Same shape as `media.rs`: named thread, loop, emit, sleep.

pub mod providers;
pub mod store;

use std::collections::HashMap;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::app::{
    fullscreen,
    monitor::{self, Edge},
};
use crate::ipc::types::{ProviderUsage, UsageSettings, UsageState, UsageWindow};
use providers::ms_to_rfc3339;

const TICK_MS: u64 = 60_000;
const CURSOR_POLL_MS: u64 = 50;
/// The interactive strip itself; the rest of the dock window is transparent
/// popover space.
pub const STRIP_LOGICAL_WIDTH: f64 = 64.0;
/// Total window width: strip + popover room (Rust-side sizing constant).
pub const WINDOW_LOGICAL_WIDTH: f64 = 360.0;
const NOTIFY_THRESHOLDS: [u32; 2] = [80, 95];

/// An interactive area of the dock window in logical, window-relative
/// pixels, reported by the frontend whenever its layout changes.
#[derive(Clone, Debug, Deserialize)]
pub struct InteractiveRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Default)]
pub struct UsageRuntime {
    pub settings: Mutex<UsageSettings>,
    pub interactive: Mutex<Vec<InteractiveRect>>,
}

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-usage"))
        .spawn(move || run(app))
        .expect("failed to start the usage thread");
}

pub fn spawn_cursor(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-dock-cursor"))
        .spawn(move || cursor_run(app))
        .expect("failed to start the dock cursor thread");
}

fn run(app: AppHandle) {
    let settings = store::load(&app);
    {
        let runtime = app.state::<UsageRuntime>();
        *runtime.settings.lock().expect("settings mutex") = settings.clone();
    }

    let adapters = providers::all();
    let mut shown = false;
    // (provider, window label, threshold) → resets_at it last fired for.
    let mut notified: HashMap<(String, String, u32), String> = HashMap::new();

    loop {
        let settings = {
            let runtime = app.state::<UsageRuntime>();
            runtime.settings.lock().expect("settings mutex").clone()
        };

        position_dock(&app, &settings.dock_side);
        if !shown {
            if let Some(window) = app.get_webview_window("dock") {
                let _ = window.show();
                shown = true;
            }
        }

        let mut provider_states = Vec::new();
        for adapter in &adapters {
            let id = adapter.id().to_string();
            let setting = settings.provider(&id);
            let present = adapter.detect();
            let output = if present && setting.enabled {
                adapter.read()
            } else {
                Default::default()
            };

            let mut windows = Vec::new();
            for (sample, past_max) in output.windows.iter().zip(&output.past_maxima) {
                let limit = setting.limit_override.or(*past_max).unwrap_or(0);
                let percent = sample.direct_percent.unwrap_or_else(|| {
                    if limit > 0 {
                        sample.used_tokens.unwrap_or(0) as f64 * 100.0 / limit as f64
                    } else {
                        0.0
                    }
                });
                let resets_at = sample.resets_at_ms.map(ms_to_rfc3339).unwrap_or_default();

                notify_threshold(
                    &app,
                    &mut notified,
                    &id,
                    &sample.label,
                    percent,
                    &resets_at,
                );

                windows.push(UsageWindow {
                    label: sample.label.clone(),
                    used: sample.used_tokens.unwrap_or(0),
                    limit,
                    percent,
                    resets_at,
                });
            }

            provider_states.push(ProviderUsage {
                id,
                present,
                enabled: setting.enabled,
                windows,
            });
        }

        let _ = app.emit("usage:update", UsageState { providers: provider_states });
        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

fn position_dock(app: &AppHandle, side: &str) {
    let Some(window) = app.get_webview_window("dock") else {
        return;
    };
    let Ok(Some(monitor_info)) = window.primary_monitor() else {
        return;
    };

    let position = monitor_info.position();
    let size = monitor_info.size();
    let (x, y, width, height) = monitor::edge_strip_rect(
        position.x,
        position.y,
        size.width,
        size.height,
        monitor_info.scale_factor(),
        WINDOW_LOGICAL_WIDTH,
        Edge::parse(side),
    );

    let _ = window.set_size(tauri::PhysicalSize::new(width, height));
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

/// Fire at 80% and 95%, once per (provider, window, reset cycle).
fn notify_threshold(
    app: &AppHandle,
    notified: &mut HashMap<(String, String, u32), String>,
    provider: &str,
    label: &str,
    percent: f64,
    resets_at: &str,
) {
    for threshold in NOTIFY_THRESHOLDS {
        if percent < threshold as f64 {
            continue;
        }
        let key = (provider.to_string(), label.to_string(), threshold);
        if notified.get(&key).is_some_and(|seen| seen == resets_at) {
            continue;
        }
        notified.insert(key, resets_at.to_string());
        let _ = app
            .notification()
            .builder()
            .title("Miro · AI usage")
            .body(format!("{provider} — {label} at {percent:.0}% used"))
            .show();
    }
}

fn cursor_run(app: AppHandle) {
    let mut ignoring = true;

    loop {
        if let Some(window) = app.get_webview_window("dock") {
            let position = window.outer_position().ok();
            let size = window.outer_size().ok();
            let scale = window.scale_factor().ok();
            let cursor = fullscreen::cursor_position();

            if let (Some(position), Some(size), Some(scale), Some(cursor)) =
                (position, size, scale, cursor)
            {
                // Cursor in logical window coordinates, matching what the
                // frontend reports in its layout rects.
                let x = (cursor.x - position.x) as f64 / scale;
                let y = (cursor.y - position.y) as f64 / scale;
                let width = size.width as f64 / scale;
                let height = size.height as f64 / scale;

                let runtime = app.state::<UsageRuntime>();
                let rects = runtime
                    .interactive
                    .lock()
                    .expect("interactive mutex")
                    .clone();

                let inside = if rects.is_empty() {
                    // Before the frontend reports anything, treat the whole
                    // strip as interactive so the rings are reachable.
                    let side = Edge::parse(&runtime.settings.lock().expect("settings mutex").dock_side);
                    let in_strip = match side {
                        Edge::Right => x >= width - STRIP_LOGICAL_WIDTH,
                        Edge::Left => x <= STRIP_LOGICAL_WIDTH,
                    };
                    in_strip && x >= 0.0 && x <= width && y >= 0.0 && y <= height
                } else {
                    rects.iter().any(|rect| {
                        x >= rect.x as f64
                            && x < (rect.x + rect.width) as f64
                            && y >= rect.y as f64
                            && y < (rect.y + rect.height) as f64
                    })
                };

                let desired = !inside;
                if desired != ignoring {
                    if window.set_ignore_cursor_events(desired).is_ok() {
                        ignoring = desired;
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(CURSOR_POLL_MS));
    }
}
