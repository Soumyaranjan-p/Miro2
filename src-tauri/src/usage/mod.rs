//! The usage engine.
//!
//! One thread reads every enabled provider's local data once a minute and
//! publishes `usage:update`; notifications fire at 80% and 95%, once per
//! (provider, window, reset cycle). Same shape as `media.rs`: named thread,
//! loop, emit, sleep. The data lives on as a notch page — there is no dock
//! window anymore.

pub mod providers;
pub mod store;

use std::collections::HashMap;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::ipc::types::{ProviderUsage, UsageSettings, UsageState, UsageWindow};
use providers::ms_to_rfc3339;

const TICK_MS: u64 = 60_000;
const NOTIFY_THRESHOLDS: [u32; 2] = [80, 95];

#[derive(Default)]
pub struct UsageRuntime {
    pub settings: Mutex<UsageSettings>,
}

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-usage"))
        .spawn(move || run(app))
        .expect("failed to start the usage thread");
}

fn run(app: AppHandle) {
    let settings = store::load(&app);
    {
        let runtime = app.state::<UsageRuntime>();
        *runtime.settings.lock().expect("settings mutex") = settings.clone();
    }

    let adapters = providers::all();
    // (provider, window label, threshold) → resets_at it last fired for.
    let mut notified: HashMap<(String, String, u32), String> = HashMap::new();

    loop {
        let settings = {
            let runtime = app.state::<UsageRuntime>();
            runtime.settings.lock().expect("settings mutex").clone()
        };

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

                notify_threshold(&app, &mut notified, &id, &sample.label, percent, &resets_at);

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
