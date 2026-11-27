//! Reads whatever the desktop is playing and publishes it to the frontend.
//!
//! Windows exposes this through the System Media Transport Controls, which is
//! the same channel the volume flyout and keyboard media keys use. Chromium
//! browsers (Brave, Edge, Chrome) publish to it whenever a tab plays audio or
//! video, so a YouTube tab in Brave shows up here with its title, channel and
//! timeline — no browser extension and no tab scraping.
//!
//! Polling rather than subscribing: `SessionsChanged` only fires when a session
//! appears or disappears, never when the timeline moves, and the frontend needs
//! the position every second anyway. One read per second is far below the cost
//! of the window's own 60Hz loop.

use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};

use crate::ipc::types::MediaState;

const TICK_MS: u64 = 1000;

pub fn spawn(app: AppHandle) {
    thread::Builder::new()
        .name(String::from("miro-media"))
        .spawn(move || run(app))
        .expect("failed to start the media thread");
}

fn run(app: AppHandle) {
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

    loop {
        let state = read_session(&manager);

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

        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

/// The most recent session that is actually playing something.
///
/// Browsers keep their session alive for a while after a video ends, and some
/// apps register one at startup and never use it, so an empty title is treated
/// as "no session" instead of showing a blank player.
fn read_session(manager: &SessionManager) -> Option<MediaState> {
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
        let position = millis(timeline.Position());
        let end = millis(timeline.EndTime());
        let playing = matches!(
            session.GetPlaybackInfo().and_then(|info| info.PlaybackStatus()),
            Ok(PlaybackStatus::Playing)
        );

        return Some(MediaState {
            session_id: text(session.SourceAppUserModelId()),
            title,
            artist,
            album: non_empty(text(properties.AlbumTitle())),
            duration_ms: end,
            position_ms: position.min(end),
            playing,
            artwork_url: None,
        });
    }

    None
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
        eprintln!("[test] read: {:?}", read_session(&manager));
    }
}
