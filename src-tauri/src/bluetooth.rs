//! Connected Bluetooth audio endpoints, polled every 3 s and published as
//! `bluetooth:update` whenever the set changes. The frontend diffs the list
//! to raise the transient connect/disconnect animations, so this side only
//! reports what Windows says is connected right now.
//!
//! Endpoints come from the Association EndPoint store filtered to connected
//! audio renderers — the same view Windows Settings reads. Battery arrives
//! through `System.Devices.AepBattery_Level` when a device exposes it; not
//! all headsets do, and the property is simply absent then.

use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationCollection};
use windows::Foundation::IReference;
use windows::core::{HSTRING, IInspectable, Interface};
use windows_collections::{IIterable, IMapView};

use crate::ipc::types::{BluetoothDeviceState, BluetoothState};

const TICK_MS: u64 = 3_000;

/// Connected audio renderers, i.e. headphone and speaker endpoints.
const SELECTOR: &str = "(System.Devices.AepCategory:=\"AudioRenderer\") \
AND (System.Devices.Aep.IsConnected:=System.StructuredQueryType.Boolean#True)";

const PROPERTIES: [&str; 2] = [
    "System.ItemNameDisplay",
    "System.Devices.AepBattery_Level",
];

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-bluetooth"))
        .spawn(move || run(app))
        .expect("failed to start the bluetooth thread");
}

fn run(app: AppHandle) {
    let mut last: Option<BluetoothState> = None;

    loop {
        let state = read_devices();
        if state.is_some() && last.as_ref() != state.as_ref() {
            let _ = app.emit("bluetooth:update", state.clone());
        }
        // Keep the last list even when a poll fails: a transient error must
        // not make the frontend believe everything disconnected.
        if state.is_some() {
            last = state;
        }
        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

fn read_devices() -> Option<BluetoothState> {
    let keys = IIterable::<HSTRING>::from(
        PROPERTIES.iter().map(|key| HSTRING::from(*key)).collect::<Vec<_>>(),
    );

    let collection = DeviceInformation::FindAllAsyncAqsFilterAndAdditionalProperties(
        &HSTRING::from(SELECTOR),
        &keys,
    )
    .and_then(|operation| operation.join())
    .ok()?;

    let devices = read_collection(&collection)?;
    Some(BluetoothState { devices })
}

fn read_collection(
    collection: &DeviceInformationCollection,
) -> Option<Vec<BluetoothDeviceState>> {
    let size = collection.Size().ok()?;
    let mut devices = Vec::new();

    for index in 0..size {
        let device = collection.GetAt(index).ok()?;
        let name = device.Name().map(|name| name.to_string()).unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let battery = device
            .Properties()
            .ok()
            .and_then(|properties| battery_of(&properties));

        devices.push(BluetoothDeviceState {
            id: device.Id().map(|id| id.to_string()).unwrap_or_default(),
            name,
            battery_percent: battery,
            connected: true,
        });
    }

    devices.sort_by(|a, b| a.name.cmp(&b.name));
    Some(devices)
}

/// Battery percentage as boxed by WinRT — a double in practice, but both
/// integer and float boxes are probed so a firmware quirk still reads.
fn battery_of(properties: &IMapView<HSTRING, IInspectable>) -> Option<u32> {
    let key = HSTRING::from("System.Devices.AepBattery_Level");
    let value = properties.Lookup(&key).ok()?;

    if let Ok(reference) = value.cast::<IReference<f64>>() {
        if let Ok(level) = reference.Value() {
            if (1.0..=100.0).contains(&level) {
                return Some(level.round() as u32);
            }
        }
    }
    if let Ok(reference) = value.cast::<IReference<u32>>() {
        if let Ok(level) = reference.Value() {
            if (1..=100).contains(&level) {
                return Some(level);
            }
        }
    }
    None
}
