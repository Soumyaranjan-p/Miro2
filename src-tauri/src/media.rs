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

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use tauri::{AppHandle, Emitter};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as SessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};
use windows::Storage::Streams::DataReader;

use crate::ipc::types::MediaState;

const TICK_MS: u64 = 1000;
/// Guard against absurd posters; a normal SMTC thumbnail is far below this.
const MAX_THUMBNAIL_BYTES: u64 = 2_000_000;
/// Chromium publishes the app icon first and swaps in the real poster a beat
/// later, so the cached image is re-read after this many ticks. For a live
/// stream the title never changes — without the re-read a first-second icon
/// would stick for hours while the OS flyout already shows the poster.
const ARTWORK_REREAD_TICKS: u32 = 10;

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
    let mut artwork = ArtworkCache::default();

    loop {
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

        thread::sleep(Duration::from_millis(TICK_MS));
    }
}

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
        let position = millis(timeline.Position());
        let end = millis(timeline.EndTime());
        let playing = matches!(
            session.GetPlaybackInfo().and_then(|info| info.PlaybackStatus()),
            Ok(PlaybackStatus::Playing)
        );

        let session_id = text(session.SourceAppUserModelId());
        let artwork_key = format!("{session_id}|{title}|{artist}");

        return Some(MediaState {
            session_id,
            title,
            artist,
            album: non_empty(text(properties.AlbumTitle())),
            duration_ms: end,
            position_ms: position.min(end),
            playing,
            artwork_url: artwork_for(&properties, &artwork_key, artwork),
        });
    }

    None
}

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
