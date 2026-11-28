//! Live machine readout for the System page: CPU, RAM and the system drive,
//! sampled every 2 s and published as `system:update`. The Rust side sends
//! honest instantaneous values; smoothing the meters is the frontend's job.

use std::path::Path;
use std::thread;
use std::time::Duration;

use sysinfo::{Disks, System};
use tauri::{AppHandle, Emitter};

use crate::ipc::types::SystemState;

const TICK_MS: u64 = 2_000;

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-system"))
        .spawn(move || run(app))
        .expect("failed to start the system thread");
}

fn run(app: AppHandle) {
    let mut sys = System::new();
    // The first CPU sample is always ~0 because the counter needs a previous
    // point to diff against; warm it before anything is published.
    sys.refresh_cpu_usage();
    thread::sleep(Duration::from_millis(500));

    loop {
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let disks = Disks::new_with_refreshed_list();
        let (disk_used, disk_total) = system_disk(&disks)
            .map(|disk| {
                (
                    disk.total_space().saturating_sub(disk.available_space()),
                    disk.total_space(),
                )
            })
            .unwrap_or((0, 0));

        let _ = app.emit(
            "system:update",
            SystemState {
                cpu_percent: sys.global_cpu_usage(),
                ram_used_bytes: sys.used_memory(),
                ram_total_bytes: sys.total_memory(),
                disk_used_bytes: disk_used,
                disk_total_bytes: disk_total,
            },
        );

        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

/// The drive the OS lives on: C:\ when it is mounted, otherwise the largest
/// fixed disk, so the Storage meter always means something.
fn system_disk(
    disks: &Disks,
) -> Option<&sysinfo::Disk> {
    let list = disks.list();
    let system = list
        .iter()
        .find(|disk| disk.mount_point() == Path::new("C:\\"));
    if system.is_some() {
        return system;
    }
    list.iter()
        .max_by_key(|disk| disk.total_space())
        .filter(|disk| disk.total_space() > 0)
}
