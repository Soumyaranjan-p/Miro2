//! Charger and battery state, read from `GetSystemPowerStatus` every 2 s and
//! published as `power:update`. The transient charging animation fires on the
//! frontend whenever `charging` flips.

use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

use crate::ipc::types::PowerState;

const TICK_MS: u64 = 2_000;

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-power"))
        .spawn(move || run(app))
        .expect("failed to start the power thread");
}

fn run(app: AppHandle) {
    let mut last: Option<PowerState> = None;

    loop {
        let state = read_power();
        // Publish only on change: nothing here moves on its own, and the
        // frontend animation is triggered by the transition, not the value.
        if last.as_ref() != Some(&state) {
            let _ = app.emit("power:update", state.clone());
            last = Some(state);
        }
        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

fn read_power() -> PowerState {
    let mut status = SYSTEM_POWER_STATUS::default();
    if unsafe { GetSystemPowerStatus(&mut status) }.is_err() {
        return PowerState {
            charging: false,
            battery_percent: None,
        };
    }

    // 0 = offline, 1 = online. Any other value reads as on battery.
    let charging = status.ACLineStatus == 1;
    // 128 = no system battery (desktop), 255 = unknown; both mean "null".
    let battery = if status.BatteryFlag & 128 != 0 || status.BatteryFlag == 255 {
        None
    } else if status.BatteryLifePercent >= 100 {
        Some(100)
    } else {
        Some(status.BatteryLifePercent as u32)
    };

    PowerState {
        charging,
        battery_percent: battery,
    }
}
