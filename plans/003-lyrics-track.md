# 003 — Lyrics track: land the line in 280ms, not 420

- **Status**: TODO
- **Commit**: 9c54427
- **Severity**: MEDIUM
- **Category**: §2 Easing & duration
- **Estimated scope**: 1 file (`src/styles/notch.css`), 1 declaration
- **Depends on**: 001 (uses `--dur-move`, `--ease-out`)

## Problem

The lyric track is the one piece of motion the user sees most often — it steps
once per line, every few seconds, for as long as music plays. It runs at 420ms,
which is 1.4× the catalog's ceiling: "UI animations stay under 300ms. Modals,
drawers, sheets, and toasts are the documented exceptions" — a lyric scroll is
none of those.

```css
/* src/styles/notch.css:411–417 — current */
.lyrics-track {
  display: flex;
  flex-direction: column;
  transition: transform 420ms cubic-bezier(0.22, 0.9, 0.24, 1);
  /* §11 — no speculative will-change: this only moves once per lyric line,
     not per frame. Promote only after measuring a real shift. */
}
```

The travel is 24px (`LyricsPage.tsx:6` `LINE_HEIGHT = 24`). At 420ms the track is
still settling for the first half of the next word — the motion outlives the event
that caused it, which is what makes an interface feel heavy. The hand-typed
`cubic-bezier(0.22, 0.9, 0.24, 1)` is also one of the three near-identical curves
§7 flags (it is within 0.02 of the canonical ease-out).

## Target

```css
/* target — src/styles/notch.css:411–417 */
.lyrics-track {
  display: flex;
  flex-direction: column;
  transition: transform var(--dur-move) var(--ease-out);
  /* §11 — no speculative will-change: this only moves once per lyric line,
     not per frame. Promote only after measuring a real shift. */
}
```

`--dur-move` is `280ms`; `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`
(`src/styles/tokens.css`, added by plan 001).

**On the curve, deliberately:** the catalog assigns `ease-in-out` to "moving /
morphing on screen", and a strict reading would send this there. It does not fit
here. The track moves 24px per line and the destination is the thing being read;
`cubic-bezier(0.77, 0, 0.175, 1)` holds the line in place for roughly the first
third of the move and then snaps it — on a 24px step that reads as hesitation
followed by a jolt, and it delays legibility. `ease-out` is the catalog's stated
default, and it is what the existing curve already was. Do not swap it back.

## Repo conventions to follow

- Motion values are tokens from `tokens.css`, never literals — the same rule the
  spring presets follow in `src/motion/spring.ts:13`.
- The `§11` comment about not pre-promoting `will-change` is a settled decision:
  leave it untouched. Measured need first, layer promotion second.

## Steps

1. Replace the `transition` line in `.lyrics-track` with
   `transition: transform var(--dur-move) var(--ease-out);`.
2. Leave every other declaration in that rule exactly as it is.

## Boundaries

- Do NOT add `will-change`, `contain`, or `backface-visibility`.
- Do NOT change `.lyric`'s colour/opacity transitions (plan 001 owns them), the
  `data-active` styling, or `LyricsPage.tsx`'s offset math.
- Do NOT touch the reduced-motion block: `.lyrics-track` is already listed there
  and `transition-duration: 0.01ms` will keep applying to the new declaration.
- Do NOT attempt to fix the one-off mount animation (track starts at `translateY(0)`
  and animates to the active line the first time the page mounts while hidden).
  It is invisible because `ExpandedPanel` mounts collapsed. Out of scope.
- If the quoted code does not match, STOP and report.

## Verification

- **Mechanical**: `npm run build` must pass. `Select-String -Path src\styles\notch.css
  -Pattern '420ms'` returns nothing.
- **Feel check**: `npm run dev`, `?phase=expanded&page=lyrics` with the mock
  timeline running (the preview advances the track every second):
  - Each line change completes well before the next one begins; there is never a
    moment where the outgoing line is still half in place while the new one is
    already the active one.
  - The incoming line reaches full opacity essentially on arrival — you should be
    able to read it immediately, not chase it.
  - In DevTools → Animations, set playback to 10%: the step must be one continuous
    deceleration with no overshoot and no second phase.
  - Emulate `prefers-reduced-motion: reduce`: the track jumps to the new line with
    no visible travel.
- **Done when**: the declaration reads `var(--dur-move) var(--ease-out)` and a line
  change is fully settled inside 300ms.
