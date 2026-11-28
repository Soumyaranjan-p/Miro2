//! Reads whatever the desktop is playing and publishes it to the frontend,
//! and drives playback back the other way.
//!
//! Windows exposes this through the System Media Transport Controls, which is
//! the same channel the volume flyout and keyboard media keys use. Chromium
//! browsers (Brave, Edge, Chrome) publish to it whenever a tab plays audio or
//! video, so a YouTube tab in Brave shows up here with its title, channel and
//! timeline — no browser extension and no tab scraping.
//!
//! Two-way: the frontend sends commands through a channel, and this thread
//! answers them against the live SMTC session (`TryTogglePlayAsync` and
//! friends — the same path the Windows media flyout uses, no focus stealing).
//! Seek goes through `TryChangePlaybackPositionAsync`, which Chromium honors
//! for YouTube; sessions that refuse it fall back to guarded arrow keys.
//!
//! Poll cadence follows the notch phase: 500 ms while the notch shows (so the
//! scrubber tracks YouTube within half a second), 1 s collapsed, 2 s hidden.

use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use tauri::{AppHandle, Emitter, Manager};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as SessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, KEYBDINPUT, INPUT, INPUT_KEYBOARD, KEYEVENTF_KEYUP, VK_LEFT, VK_RIGHT,
    VIRTUAL_KEY,
};
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

use crate::app::hover::NotchPhase;
use crate::app::notch::NotchRuntime;
use crate::ipc::types::MediaState;

const TICK_MS: u64 = 1_000;
/// Guard against absurd posters; a normal SMTC thumbnail is far below this.
const MAX_THUMBNAIL_BYTES: u64 = 2_000_000;
/// Chromium publishes the app icon first and swaps in the real poster a beat
/// later, so the cached image is re-read after this many ticks. For a live
/// stream the title never changes — without the re-read a first-second icon
/// would stick for hours while the OS flyout already shows the poster.
const ARTWORK_REREAD_TICKS: u32 = 10;

/// The artwork of the current track. A fresh track starts blank and retries
/// every tick until its artwork arrives; a known track re-reads periodically
/// so late poster swaps are picked up, keeping the last good image if a
/// refresh fails rather than flickering to blank.
#[derive(Default)]
struct ArtworkCache {
    key: String,
    url: Option<String>,
    ticks_since_read: u32,
}
/// YouTube nudges ±5 s per arrow press; this caps one seek at 5 minutes.
const MAX_SEEK_PRESSES: usize = 60;
const SEEK_STEP_MS: i64 = 5_000;

/// Commands from the frontend, delivered through the media thread.
#[derive(Clone, Debug)]
pub enum MediaCommand {
    Toggle,
    Play,
    Pause,
    Next,
    Previous,
    /// Target position in milliseconds.
    Seek(u64),
}

/// Managed handle for the invoke command. `Sender` is not `Sync`, hence the
/// mutex — only the media thread consumes the receiver end.
pub struct MediaRuntime {
    tx: Mutex<Sender<MediaCommand>>,
}

impl MediaRuntime {
    /// Pair this with the receiver handed to [`spawn`].
    pub fn new(tx: Sender<MediaCommand>) -> Self {
        Self {
            tx: Mutex::new(tx),
        }
    }

    pub fn send(&self, command: MediaCommand) -> Result<(), String> {
        self.tx
            .lock()
            .expect("media command mutex")
            .send(command)
            .map_err(|error| error.to_string())
    }
}

pub fn spawn(app: AppHandle, rx: Receiver<MediaCommand>) {
    thread::Builder::new()
        .name(String::from("miro-media"))
        .spawn(move || run(app, rx))
        .expect("failed to start the media thread");
}

fn run(app: AppHandle, rx: Receiver<MediaCommand>) {
    // `RequestAsync` blocks until the OS answers; this thread is not the UI
    // thread, so the wait is free.
    let manager = match SessionManager::RequestAsync().and_then(|operation| operation.join()) {
        Ok(manager) => manager,
        Err(error) => {
            eprintln!("[media] no session manager: {error}");
            return;
        }
    };

    let mut had_session = false;
    let mut artwork = ArtworkCache::default();

    loop {
        drain_commands(&app, &manager, &rx);

        let state = read_session(&manager, &mut artwork);

        // Nothing playing is worth announcing once, not sixty times a minute.
        if state.is_some() || had_session {
            if let Some(current) = &state {
                eprintln!("[media] {} — {}", current.artist, current.title);
            } else {
                eprintln!("[media] nothing playing");
            }
            let _ = app.emit("media:update", state.clone());
        }
        had_session = state.is_some();

        sleep_with_commands(&app, &manager, &rx, tick_for_phase(&app));
    }
}

/// Ticks speed up while the notch shows a page (500 ms keeps the scrubber
/// glued to YouTube) and slow down when it is hidden (2 s).
fn tick_for_phase(app: &AppHandle) -> u64 {
    let phase = app
        .try_state::<NotchRuntime>()
        .map(|runtime| runtime.phase())
        .unwrap_or(NotchPhase::Collapsed);
    match phase {
        NotchPhase::Expanded | NotchPhase::Hover => 500,
        NotchPhase::Collapsed => TICK_MS,
        NotchPhase::Hidden => 2_000,
    }
}

/// Sleep in 100 ms slices, answering commands the whole way so a press in
/// Miro reaches YouTube well inside a second.
fn sleep_with_commands(
    app: &AppHandle,
    manager: &SessionManager,
    rx: &Receiver<MediaCommand>,
    total_ms: u64,
) {
    let mut waited = 0u64;
    while waited < total_ms {
        thread::sleep(Duration::from_millis(100.min(total_ms - waited)));
        waited += 100;
        drain_commands(app, manager, rx);
    }
}

fn drain_commands(app: &AppHandle, manager: &SessionManager, rx: &Receiver<MediaCommand>) {
    loop {
        match rx.try_recv() {
            Ok(command) => handle_command(app, manager, command),
            Err(TryRecvError::Empty) => return,
            Err(TryRecvError::Disconnected) => return,
        }
    }
}

fn handle_command(app: &AppHandle, manager: &SessionManager, command: MediaCommand) {
    let Some(session) = active_session(manager) else {
        eprintln!("[media] command skipped: no session");
        return;
    };

    let result: Result<(), String> = match command {
        MediaCommand::Toggle => session
            .TryTogglePlayPauseAsync()
            .map_err(str_err)
            .and_then(|operation| operation.join().map(|_| ()).map_err(str_err)),
        MediaCommand::Play => session
            .TryPlayAsync()
            .map_err(str_err)
            .and_then(|operation| operation.join().map(|_| ()).map_err(str_err)),
        MediaCommand::Pause => session
            .TryPauseAsync()
            .map_err(str_err)
            .and_then(|operation| operation.join().map(|_| ()).map_err(str_err)),
        MediaCommand::Next => session
            .TrySkipNextAsync()
            .map_err(str_err)
            .and_then(|operation| operation.join().map(|_| ()).map_err(str_err)),
        MediaCommand::Previous => session
            .TrySkipPreviousAsync()
            .map_err(str_err)
            .and_then(|operation| operation.join().map(|_| ()).map_err(str_err)),
        MediaCommand::Seek(target_ms) => {
            seek_session(app, &session, target_ms);
            Ok(())
        }
    };

    if let Err(error) = result {
        eprintln!("[media] command failed: {error}");
    }
}

fn str_err<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}

/// The session read_session would pick: the most recent one that is playing.
fn active_session(manager: &SessionManager) -> Option<GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    let count = sessions.Size().ok()?;

    for index in 0..count {
        let session = sessions.GetAt(index).ok()?;
        let properties = session
            .TryGetMediaPropertiesAsync()
            .and_then(|operation| operation.join())
            .ok()?;
        let title = text(properties.Title());
        let artist = text(properties.Artist());
        if !title.is_empty() || !artist.is_empty() {
            return Some(session);
        }
    }
    None
}

/// Seeking. SMTC's `TryChangePlaybackPositionAsync` is the real command —
/// Chromium publishes seek controls for YouTube, so the position jumps
/// regardless of which window has focus. The arrow-key path only exists for
/// sessions that refuse the SMTC seek (it returns false or errors), and then
/// only when a browser is the foreground window, so keys never land in
/// whatever the user is typing in.
fn seek_session(
    app: &AppHandle,
    session: &GlobalSystemMediaTransportControlsSession,
    target_ms: u64,
) {
    let Ok(timeline) = session.GetTimelineProperties() else {
        // Player not ready to report a timeline; nothing to seek against.
        return;
    };
    let end = millis(timeline.EndTime());
    if end == 0 {
        // Live stream: the scrubber is hidden and there is no end to seek to.
        return;
    }

    // Seeking past the end clamps to it, like every player does.
    let target_ms = target_ms.min(end);
    let target_ticks = (target_ms as i64) * 10_000; // TimeSpan counts 100ns.

    let smtc_applied = match session.TryChangePlaybackPositionAsync(target_ticks) {
        Ok(operation) => operation.join().unwrap_or(false),
        Err(_) => false,
    };

    if smtc_applied {
        eprintln!("[media] seek → {target_ms} ms (SMTC)");
    } else {
        arrow_key_fallback(session, target_ms);
    }

    // Surface the next poll's position immediately so the scrubber does not
    // wait half a second to snap to reality.
    let Ok(timeline) = session.GetTimelineProperties() else {
        return;
    };
    let _ = app.emit(
        "media:update",
        Some(read_current_state(session, &timeline, &mut ArtworkCache::default())),
    );
}

/// Degrade to ±5 s arrow presses at the browser. YouTube nudges 5 s per press
/// and caps one seek at 5 minutes.
fn arrow_key_fallback(
    session: &GlobalSystemMediaTransportControlsSession,
    target_ms: u64,
) {
    let Ok(timeline) = session.GetTimelineProperties() else {
        return;
    };
    let position = millis(timeline.Position()) as i64;
    let delta = target_ms as i64 - position;
    if delta.abs() < 2_000 {
        return;
    }

    let steps = ((delta.abs() / SEEK_STEP_MS) as usize).min(MAX_SEEK_PRESSES);
    let forward = delta > 0;

    if !foreground_is_browser() {
        eprintln!("[media] seek fallback skipped: browser is not the foreground window");
        return;
    }

    eprintln!("[media] seek fallback: {delta:+} ms via {steps} arrow presses");
    send_arrow_presses(steps, forward);
}

fn send_arrow_presses(steps: usize, forward: bool) {
    let key = VIRTUAL_KEY(if forward { VK_RIGHT.0 } else { VK_LEFT.0 });
    let mut buffer = [down_input(key), up_input(key)];
    for _ in 0..steps {
        unsafe {
            SendInput(&mut buffer, 2);
        }
        thread::sleep(Duration::from_millis(15));
    }
}

fn down_input(key: VIRTUAL_KEY) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn up_input(key: VIRTUAL_KEY) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// The seek keys must reach the browser. Synthesized input goes to the
/// foreground window, so the check is: is the foreground process a browser?
fn foreground_is_browser() -> bool {
    const BROWSERS: [&str; 8] = [
        "chrome", "msedge", "brave", "opera", "vivaldi", "firefox", "arc", "yandex",
    ];

    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd == HWND::default() {
        return false;
    }

    let mut pid = 0u32;
    unsafe {
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }
    if pid == 0 {
        return false;
    }

    let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }) else {
        return false;
    };

    let mut buffer = [0u16; 512];
    let mut length = buffer.len() as u32;
    let name = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut length,
        )
    };
    let _ = unsafe { windows::Win32::Foundation::CloseHandle(process) };

    let Ok(()) = name else { return false };
    let exe = String::from_utf16_lossy(&buffer[..length as usize]);
    let basename = exe.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase();
    BROWSERS.iter().any(|browser| basename.contains(browser))
}

/// The most recent session that is actually playing something.
///
/// Browsers keep their session alive for a while after a video ends, and some
/// apps register one at startup and never use it, so an empty title is treated
/// as "no session" instead of showing a blank player.
fn read_session(manager: &SessionManager, artwork: &mut ArtworkCache) -> Option<MediaState> {
    let sessions = manager.GetSessions().ok()?;
    let count = sessions.Size().ok()?;

    for index in 0..count {
        let session = sessions.GetAt(index).ok()?;
        let properties = session
            .TryGetMediaPropertiesAsync()
            .and_then(|operation| operation.join())
            .ok()?;

        let title = text(properties.Title());
        let artist = text(properties.Artist());
        if title.is_empty() && artist.is_empty() {
            continue;
        }

        let timeline = session.GetTimelineProperties().ok()?;
        let state = read_current_state(&session, &timeline, artwork);
        return Some(state);
    }

    None
}

fn read_current_state(
    session: &GlobalSystemMediaTransportControlsSession,
    timeline: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionTimelineProperties,
    artwork: &mut ArtworkCache,
) -> MediaState {
    let properties = session
        .TryGetMediaPropertiesAsync()
        .and_then(|operation| operation.join())
        .expect("media properties");

    let title = text(properties.Title());
    let artist = text(properties.Artist());
    let position = millis(timeline.Position());
    let end = millis(timeline.EndTime());
    let playing = matches!(
        session.GetPlaybackInfo().and_then(|info| info.PlaybackStatus()),
        Ok(PlaybackStatus::Playing)
    );

    let session_id = text(session.SourceAppUserModelId());
    let artwork_key = format!("{session_id}|{title}|{artist}");

    MediaState {
        session_id,
        title,
        artist,
        album: non_empty(text(properties.AlbumTitle())),
        duration_ms: end,
        position_ms: position.min(end),
        playing,
        artwork_url: artwork_for(&properties, &artwork_key, artwork),
    }
}

/// The most recent session that is actually playing something.
///
/// Browsers keep their session alive for a while after a video ends, and some
/// apps register one at startup and never use it, so an empty title is treated
/// as "no session" instead of showing a blank player.
fn artwork_for(
    properties: &SessionMediaProperties,
    key: &str,
    cache: &mut ArtworkCache,
) -> Option<String> {
    if cache.key != key {
        // A fresh track shows nothing until its own artwork arrives — never
        // the previous track's image.
        cache.key = key.to_string();
        cache.url = read_thumbnail(properties);
        cache.ticks_since_read = 0;
    } else if cache.url.is_none() || cache.ticks_since_read >= ARTWORK_REREAD_TICKS {
        // Retry while blank; refresh periodically once an image exists, and
        // keep the last good one if a refresh fails.
        if let Some(url) = read_thumbnail(properties) {
            cache.url = Some(url);
        }
        cache.ticks_since_read = 0;
    } else {
        cache.ticks_since_read += 1;
    }
    cache.url.clone()
}

/// SMTC ships the artwork the publishing app provided — for a browser tab
/// that is the video poster. Inlined as a data URL so the webview needs no
/// asset-protocol scope and no temp files.
fn read_thumbnail(properties: &SessionMediaProperties) -> Option<String> {
    let reference = properties.Thumbnail().ok()?;
    let stream = reference
        .OpenReadAsync()
        .and_then(|operation| operation.join())
        .ok()?;
    let size = stream.Size().ok()?;
    if size == 0 || size > MAX_THUMBNAIL_BYTES {
        return None;
    }
    let content_type = stream
        .ContentType()
        .map(|value| value.to_string())
        .unwrap_or_default();

    let reader = DataReader::CreateDataReader(&stream).ok()?;
    reader
        .LoadAsync(size as u32)
        .and_then(|operation| operation.join())
        .ok()?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes).ok()?;

    let mime = match content_type.as_str() {
        "image/png" | "image/jpeg" | "image/webp" | "image/gif" => content_type,
        _ => sniff_mime(&bytes)?.to_string(),
    };
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

/// A minority of apps publish an empty content type; the magic bytes decide.
fn sniff_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"RIFF") && bytes.len() > 11 && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif")
    } else {
        None
    }
}

fn text(value: windows::core::Result<windows::core::HSTRING>) -> String {
    value.map(|value| value.to_string()).unwrap_or_default().trim().to_string()
}

fn non_empty(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

/// `TimeSpan` counts 100ns ticks; a negative value means "not seekable yet".
fn millis(value: windows::core::Result<windows::Foundation::TimeSpan>) -> u64 {
    value
        .map(|span| span.Duration)
        .unwrap_or(0)
        .div_euclid(10_000)
        .max(0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Depends on whatever the desktop is playing, so it is opt-in:
    /// `cargo test -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn reads_the_desktop_session() {
        let manager = SessionManager::RequestAsync()
            .and_then(|operation| operation.join())
            .expect("session manager");

        let count = manager.GetSessions().expect("sessions").Size().unwrap_or(0);
        eprintln!("[test] sessions on the desktop: {count}");
        let mut artwork = ArtworkCache::default();
        eprintln!("[test] read: {:?}", read_session(&manager, &mut artwork));
    }
}
