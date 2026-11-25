use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

use super::fullscreen::{cursor_position, foreground_is_fullscreen};
use super::hover::{HoverTracker, NotchPhase};
use super::monitor::top_center_rect;
use crate::ipc::types::NotchState;

const WINDOW_LABEL: &str = "notch";
const COLLAPSED_WIDTH: f64 = 152.0;
const COLLAPSED_HEIGHT: f64 = 30.0;
const EXPANDED_WIDTH: f64 = 420.0;
const EXPANDED_HEIGHT: f64 = 150.0;
const TICK_MS: u64 = 60;
const SLOW_TICK_EVERY: u32 = 8;
const HOVER_PADDING: i32 = 8;

#[derive(Default)]
pub struct NotchRuntime {
    phase: Mutex<NotchPhase>,
}

impl NotchRuntime {
    pub fn phase(&self) -> NotchPhase {
        self.phase
            .lock()
            .map(|phase| *phase)
            .unwrap_or(NotchPhase::Collapsed)
    }

    fn set_phase(&self, phase: NotchPhase) {
        if let Ok(mut current) = self.phase.lock() {
            *current = phase;
        }
    }
}

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-notch"))
        .spawn(move || run(app))
        .expect("failed to start the notch thread");
}

fn hide_from_taskbar(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };

    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let next = (current | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0;
        if next == current {
            return;
        }

        eprintln!("[notch] taskbar style {current:#010x} -> {next:#010x} on {hwnd:?}");
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next as isize);
        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    }
}

fn run(app: AppHandle) {
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        return;
    };

    let runtime = app.state::<NotchRuntime>();
    let started = Instant::now();
    let mut tracker = HoverTracker::new();
    let mut hidden = false;
    let mut tick: u32 = 0;

    hide_from_taskbar(&window);
    if place(&window, NotchPhase::Collapsed).is_err() {
        return;
    }
    if window.show().is_err() {
        return;
    }
    publish(&window, &runtime, NotchPhase::Collapsed);

    loop {
        if app.get_webview_window(WINDOW_LABEL).is_none() {
            break;
        }

        let now_ms = started.elapsed().as_millis() as u64;

        if tick % SLOW_TICK_EVERY == 0 {
            let fullscreen = foreground_is_fullscreen(&window);

            if fullscreen && !hidden {
                hidden = true;
                tracker.reset();
                let _ = window.hide();
                publish(&window, &runtime, NotchPhase::Hidden);
            } else if !fullscreen && hidden {
                hidden = false;
                tracker.reset();
                let _ = place(&window, NotchPhase::Collapsed);
                let _ = window.show();
                publish(&window, &runtime, NotchPhase::Collapsed);
            } else if !hidden {
                ensure_layout(&window, tracker.phase());
            }
        }

        if !hidden {
            let inside = cursor_inside(&window);
            let phase = tracker.step(inside, now_ms);

            if phase != runtime.phase() {
                if apply_phase(&window, phase).is_err() {
                    break;
                }
                publish(&window, &runtime, phase);
            }
        }

        thread::sleep(Duration::from_millis(TICK_MS));
        tick = tick.wrapping_add(1);
    }
}

fn publish(window: &WebviewWindow, runtime: &NotchRuntime, phase: NotchPhase) {
    runtime.set_phase(phase);
    let _ = window.emit("notch:state", NotchState { phase });
    eprintln!("[notch] {}", phase_label(phase));
}

fn phase_label(phase: NotchPhase) -> &'static str {
    match phase {
        NotchPhase::Collapsed => "collapsed",
        NotchPhase::Hover => "hover",
        NotchPhase::Expanded => "expanded",
        NotchPhase::Hidden => "hidden (full-screen)",
    }
}

fn dimensions(phase: NotchPhase) -> (f64, f64) {
    match phase {
        NotchPhase::Expanded => (EXPANDED_WIDTH, EXPANDED_HEIGHT),
        _ => (COLLAPSED_WIDTH, COLLAPSED_HEIGHT),
    }
}

fn target_rect(monitor: &Monitor, phase: NotchPhase) -> (i32, i32, u32, u32) {
    let (width, height) = dimensions(phase);
    top_center_rect(
        monitor.position().x,
        monitor.position().y,
        monitor.size().width,
        monitor.scale_factor(),
        width,
        height,
    )
}

fn apply_phase(window: &WebviewWindow, phase: NotchPhase) -> tauri::Result<()> {
    match phase {
        NotchPhase::Hidden => Ok(()),
        _ => place(window, phase),
    }
}

fn place(window: &WebviewWindow, phase: NotchPhase) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };

    let (x, y, width, height) = target_rect(&monitor, phase);
    window.set_size(PhysicalSize::new(width, height))?;
    window.set_position(PhysicalPosition::new(x, y))?;
    Ok(())
}

fn ensure_layout(window: &WebviewWindow, phase: NotchPhase) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };

    let (x, y, width, height) = target_rect(&monitor, phase);
    let matches = match (window.outer_position(), window.outer_size()) {
        (Ok(position), Ok(size)) => {
            position.x == x && position.y == y && size.width == width && size.height == height
        }
        _ => false,
    };

    if !matches {
        let _ = window.set_size(PhysicalSize::new(width, height));
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

fn cursor_inside(window: &WebviewWindow) -> bool {
    let (Ok(position), Ok(size), Some(cursor)) = (
        window.outer_position(),
        window.outer_size(),
        cursor_position(),
    ) else {
        return false;
    };

    let left = position.x - HOVER_PADDING;
    let top = position.y - HOVER_PADDING;
    let right = position.x + size.width as i32 + HOVER_PADDING;
    let bottom = position.y + size.height as i32 + HOVER_PADDING;

    (left..right).contains(&cursor.x) && (top..bottom).contains(&cursor.y)
}
