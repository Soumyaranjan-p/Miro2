use tauri::{Monitor, WebviewWindow};
use windows::Win32::Foundation::{HWND, POINT, RECT};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_BUSY, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetCursorPos, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
    IsZoomed,
};

pub fn cursor_position() -> Option<POINT> {
    let mut point = POINT::default();
    unsafe { GetCursorPos(&mut point).ok()? };
    Some(point)
}

pub fn foreground_is_fullscreen(window: &WebviewWindow) -> bool {
    if shell_reports_fullscreen() {
        return true;
    }

    let Ok(Some(monitor)) = window.primary_monitor() else {
        return false;
    };

    foreground_window()
        .map(|hwnd| covers_monitor(hwnd, &monitor))
        .unwrap_or(false)
}

fn shell_reports_fullscreen() -> bool {
    unsafe {
        match SHQueryUserNotificationState() {
            Ok(state) => state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN,
            Err(_) => false,
        }
    }
}

fn foreground_window() -> Option<HWND> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.is_invalid() {
        return None;
    }

    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    if pid == std::process::id() {
        return None;
    }

    if is_shell_window(hwnd) {
        return None;
    }

    if unsafe { IsZoomed(hwnd).as_bool() } {
        return None;
    }

    Some(hwnd)
}

fn covers_monitor(hwnd: HWND, monitor: &Monitor) -> bool {
    let mut rect = RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
        return false;
    }

    let position = monitor.position();
    let size = monitor.size();
    let right = position.x + size.width as i32;
    let bottom = position.y + size.height as i32;

    rect.left <= position.x + 2
        && rect.top <= position.y + 2
        && rect.right >= right - 2
        && rect.bottom >= bottom - 2
}

fn is_shell_window(hwnd: HWND) -> bool {
    let mut buffer = [0u16; 64];
    let length = unsafe { GetClassNameW(hwnd, &mut buffer) };
    if length <= 0 {
        return false;
    }

    let class = String::from_utf16_lossy(&buffer[..length as usize]);
    matches!(
        class.as_str(),
        "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
    )
}
