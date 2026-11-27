# 004 — Water fill: composite the level, and bring it inside the duration budget

- **Status**: TODO
- **Commit**: 9c54427
- **Severity**: MEDIUM
- **Category**: §5 Performance, §2 Easing & duration
- **Estimated scope**: 2 files (`src/styles/notch.css`, `src/notch/pages/WaterPage.tsx`), ~6 lines
- **Depends on**: 001 (uses `--dur-move`, `--ease-out`)

## Problem

The water level is animated by transitioning `height` — a layout property — for
560ms, which is 1.9× the catalog ceiling for UI motion with no exemption
available. It is also the *entire* feedback for the drink action, so its length is
what the user experiences after every press.

```css
/* src/styles/notch.css:571–580 — current */
.bottle-fill {
  width: 100%;
  border-radius: 4px 4px 7px 7px;
  background: linear-gradient(
    180deg,
    rgb(var(--accent) / 0.9),
    rgb(var(--accent) / 0.5)
  );
  transition: height 560ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

```tsx
// src/notch/pages/WaterPage.tsx:36 — current
<div className="bottle-fill" style={{ height: `${ratio * 100}%` }} />
```

Catalog: "Prefer `transform` and `opacity` … `width`/`height`/`margin`/`padding`/
`top`/`left` trigger layout + paint + composite." The cost here is genuinely small
(26×64px element, once per drink) — the duration is the bigger defect — but the fix
is the same and costs nothing: a bottom-anchored `scaleY` composites, and no longer
reflows the water row while it plays.

## Target

```css
/* target — src/styles/notch.css:571–580 */
.bottle-fill {
  width: 100%;
  height: 100%;
  border-radius: 4px 4px 7px 7px;
  background: linear-gradient(
    180deg,
    rgb(var(--accent) / 0.9),
    rgb(var(--accent) / 0.5)
  );
  transform-origin: bottom center;
  transform: scaleY(0);
  transition: transform var(--dur-move) var(--ease-out);
}
```

```tsx
// target — src/notch/pages/WaterPage.tsx:36
<div className="bottle-fill" style={{ transform: `scaleY(${ratio})` }} />
```

`.bottle` is already `display: flex; align-items: flex-end;` (`notch.css:560`), so a
full-height child anchored at `bottom center` is the same geometry the percentage
height produced, with the level expressed as a scale instead of a reflow.

## Repo conventions to follow

- Per-frame or state-driven values are written as inline styles / custom properties
  from React, never as generated class names — see `LyricsPage.tsx:32`
  (`style={{ transform: \`translateY(${offset}px)\` }}`) and `Scrubber.tsx:48`.
- The `ratio` is already clamped in `WaterPage.tsx:19` (`Math.min(1, …)`), so
  `scaleY` cannot exceed 1 and the fill cannot overflow the bottle.
- Tokens, not literals — `--dur-move` / `--ease-out` from `tokens.css`.

## Steps

1. In `.bottle-fill`, add `height: 100%;`, add `transform-origin: bottom center;`,
   add `transform: scaleY(0);`, and replace the `transition` line with
   `transition: transform var(--dur-move) var(--ease-out);`.
2. In `WaterPage.tsx`, replace the inline `height` with the inline `transform`.

## Boundaries

- Do NOT change `.bottle`'s dimensions, its `align-items: flex-end`, or the
  `bottleMl` copy.
- Do NOT add `overflow: hidden` to `.bottle` and do NOT remove the fill's
  `border-radius` — the 7px bottom radius is a deliberate inset corner.
- Do NOT add the goal-reached celebration here; that is plan 006, and it is
  additive and optional.
- Do NOT touch the reduced-motion block: `.bottle-fill` is already listed there and
  `transition-duration: 0.01ms` keeps applying to the new declaration.
- If the quoted code does not match, STOP and report.

## Verification

- **Mechanical**: `npm run build` must pass. `Select-String -Path src\styles\notch.css
  -Pattern '560ms'` returns nothing; `WaterPage.tsx` no longer contains `height:` in
  a `style` object.
- **Feel check**: `npm run dev`, `?phase=expanded&page=water`:
  - Press "Drink 250 ml" — the level rises from the bottom and is settled inside
    300ms; the number above it and the bottle must finish together (the number has
    no animation, so a long fill leaves them visibly out of step).
  - Press it repeatedly to fill the bottle: each press retargets from the current
    level, it never restarts from empty.
  - At a low level (10–25%), look at the bottom corners of the fill: they must
    still read as rounded. A compressed radius at these sizes is sub-pixel, but
    confirm by eye and report if it reads square.
  - Emulate `prefers-reduced-motion: reduce`: the level jumps with no travel.
- **Done when**: no layout property is transitioned on the water page, the fill
  settles under 300ms, and rapid presses read as one continuous rise.
