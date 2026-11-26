# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desktop workers who keep a media player, a focus timer, a water log, pinned
files, and a short task list in view while they work. They glance at the top
edge for a second and do not want to open another window.

## Product Purpose

Miro is a frameless, always-on-top notch strip at the top-center of a Windows
display. It collapses to a small pill and expands on hover into pages for now
playing, synced lyrics, focus, water, shelf, to-do, and settings. Success means
the user can read or act without leaving their current task.

## Positioning

A single quiet notch that gathers live personal state and steps aside when not
needed, with no accounts and no tracking.

## Operating Context

Windows 10/11 desktop; Tauri v2 shell around a React webview. Collapsed window
152×30 logical px, expanded 420×150 logical px, top-center of the primary
monitor. Hover opens after a short delay; moving away closes after a grace
period. The app hides while a full-screen application is foreground.

## Capabilities and Constraints

- Pages: Music, Lyrics, Focus, Water, Shelf, To-do, Settings.
- Hover phases: collapsed, hover, expanded, hidden.
- Media through the Windows media overlay; lyrics from a synced source;
  Pomodoro rounds; water entries; local shelf paths; local tasks; local settings.
- Dark and light themes; English and Indonesian copy.
- Respects `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Window-size contract and Rust code are fixed for this redesign.
- No Nusa text, icons, or assets may appear in Miro.

## Brand Commitments

Name: Miro. Voice: quiet, direct, specific. One accent family across themes.

## Evidence on Hand

`SPEC.md` and `ARCHITECTURE.md` document the inferred reference behavior;
`src/ipc/mock.ts` carries synthetic but realistic content used in browser
previews. No real user data ships in the repository.

## Product Principles

1. Glance first: the primary fact is readable at a glance.
2. Stay out of the way: collapse quickly, never steal focus.
3. One surface: pages are views of the same notch, not separate windows.
4. Local and private: data stays on the device.
5. Motion explains state; it never decorates it.

## Accessibility & Inclusion

Keyboard navigation for pages and controls, visible focus ring, reduced-motion
and reduced-transparency fallbacks, and text contrast targets of 4.5:1 for
body copy and 3:1 for large text.
