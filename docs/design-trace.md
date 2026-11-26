# Apple-design trace for the Miro notch redesign

Design law: `.agents/skills/apple-design/SKILL.md` (read in full before any edit).
Section numbers below refer to that file. Nothing in this document is a claim
that the result is *pretty*; each row states the principle, the code change, and
the observable behavior the change produces.

## Why this was a redesign, not a restyle

The notch already had spring code and traceability comments. The work here
targets places where the implementation still contradicted the law:

- page changes were fixed-duration CSS `@keyframes` with a `setTimeout` cleanup —
  the exact pattern §3 forbids for anything a user can interrupt;
- there was no way to grab a page transition or to throw one with velocity, so
  §2/§5/§6/§9 existed only in the seek bar;
- the expanded panel spent a whole row repeating the label of the selected tab
  and the clock from the collapsed pill (§16, §12).

## Change → principle map

| # | Change (files) | Principle | Why it follows the law |
|---|---|---|---|
| 1 | Replaced the two-layer keyframed page cross-slide with one continuous `cursor` value driven by the existing spring; deleted `page-in`/`page-out`/fade keyframes and the 260 ms removal timer (`notch/PageStage.tsx`, `styles/notch.css`) | **§3 Interruptibility**, **§4 Behavior over animation**, **§7 Spatial consistency**, **§8 Hint direction**, **§14 Reduced motion** | A tab picked mid-slide now re-targets the spring from its live on-screen value instead of restarting a 240 ms animation. Input is never locked out. Enter and exit share the same horizontal path, and the incoming page comes from the side of the chosen tab. Reduced motion jumps to the target and cross-fades instead of sweeping. |
| 2 | Added `Spring.pause()` so a gesture can take over an in-flight spring without losing position or velocity (`motion/spring.ts`) | **§3 Interruptibility**, **§5 Velocity handoff** | Implements "grab a moving element mid-flight and reverse it" — the spring resumes from the presentation value and carries velocity through the re-target, avoiding a reversal discontinuity. |
| 3 | Added swipe paging: 10 px direction hysteresis, pointer capture with graceful fallback, 1:1 tracking from the grab point, rubber-band at both ends, release velocity handed to the spring, and a landing page chosen by projecting that velocity to the nearest page (`notch/PageStage.tsx`, `motion/spring.ts`) | **§2 Direct manipulation**, **§5 Velocity handoff**, **§6 Momentum projection**, **§9 Rubber-banding**, **§10 Gesture details**, **§16 Agency** | Content follows the finger exactly, resists at edges, and continues at the finger's velocity with no drag→animation seam. A cancelled gesture springs back to the current page, so slips are forgiven. The seek bar deliberately keeps *no* projection (it has no snap targets) — using §6 there would seek past where the user released. |
| 4 | Per-frame work writes only `transform` and `opacity` directly to the six page slots; no React state or render occurs during a gesture (`notch/PageStage.tsx`) | **§11 Frame-level smoothness** | Keeps the hot path on compositor-friendly properties and display-synced frames; `will-change` stays off until a shift is measured. |
| 5 | Removed the expanded header row (title + clock); the clock is now a small, non-interactive floating meta element (`notch/ExpandedPanel.tsx`, `styles/notch.css`) | **§16 Simplicity — not minimalism**, **§12 Materials & depth**, **§16 Wayfinding** | The title repeated the selected tab and the clock repeated the collapsed pill: neither earned a structural row. The selected tab answers "where am I?", and content regains ~20 px of height. Removing one translucent layer also avoids stacking light surfaces. |
| 6 | Tab bar is now a lighter translucent material (`backdrop-filter: blur(14px) saturate(160%)`) with a bright top edge; a soft gradient fades content into it instead of a divider (`styles/notch.css`) | **§12 Materials & depth**, **§12 Vibrancy**, **§12 Scroll edge effects** | Material weight encodes hierarchy: dark near-opaque structural shell, lighter interactive material on top, solid light indicator above that. The shell stays near-opaque on purpose — a Tauri webview cannot blur the OS wallpaper behind it, so translucency lives *inside* the surface where it actually works. |
| 7 | Collapsed brand and clock now use the size-specific type ramp tokens instead of two hardcoded 12 px sizes (`styles/notch.css`) | **§15 Typography** | Tracking and leading are size-specific; emphasis comes from weight. The platform system font is retained (§15 default). |
| 8 | Instant press feedback on lyric rows (`.lyric:active`); existing pointer-down feedback on tabs, icon buttons, drink button and checkboxes retained (`styles/notch.css`, `notch/PageTabs.tsx`) | **§1 Response**, **§10 Gesture design details** | Highlight fires on pointer-down; commit stays on pointer-up, which is the §10 tap contract. No feedback waits for an animation or a debounce. |
| 9 | Removed speculative `will-change: transform` from the lyrics track (`styles/notch.css`) | **§11 Frame-level smoothness** | That track moves once per lyric line, not every frame; promotion should follow a measured shift, not a guess. |
| 10 | Accessibility tightened: off-screen slots are `inert` + `aria-hidden`; reduced-motion swaps slides for a short opacity cross-fade; reduced-transparency frosts the tab material and edge fade; high contrast strengthens the tab indicator and focus track; the media-query flip is handled live (`notch/PageStage.tsx`, `styles/notch.css`) | **§14 Reduced motion & accessibility** | Reduced motion means a gentler equivalent, not no feedback. Color/opacity changes that aid comprehension are kept; slides and springs are dropped. |

Build hygiene (not a design change): the trace document is excluded from
Tailwind's source scan with `@source not "../../docs/**"` in `tokens.css`, so
prose in this file cannot generate dead utility CSS in the shipped bundle.

## Deliberately unchanged

- **No sound or haptics** (§13): Windows WebView2 offers no haptic channel and
  an always-on-top utility would over-feedback; §13's utility rule excludes it.
- **No momentum projection on the seek bar** (§6): documented in
  `notch/controls/Scrubber.tsx` — a seek bar has no snap targets.
- **No spring on the lyrics auto-scroll** (§4): it is driven by playback
  position, not by a gesture; a discrete line change is not a manipulable value.

## Verification performed

- `npm run build` — TypeScript + Vite, clean.
- Browser preview at all six pages plus collapsed state, no console errors.
- Tab click: selected tab and target slot advance; swept slots get opacity by
  distance and `inert`/`aria-hidden`.
- Synthetic flick with realistic inter-move timing: a 100 px leftward throw from
  Music projected to page 2 (Focus) and set it as the landing page.
- Browser media-query value checked: `prefers-reduced-motion: reduce` is false
  in the test session, so the spring path (not the static path) was exercised.

Note: the attached preview browser throttles `requestAnimationFrame` to a few
frames per second while its tab is in the background, so screenshots can catch
the pager mid-slide. The production Tauri window is foreground and renders at
display rate; no animation logic depends on the throttled behavior.
