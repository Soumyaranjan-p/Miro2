# 002 — Scrubber: nothing appears from nothing, and the rail stays on the compositor

- **Status**: TODO
- **Commit**: 9c54427
- **Severity**: MEDIUM
- **Category**: §3 Physicality & origin, §6 Accessibility, §5 Performance
- **Estimated scope**: 2 files (`src/styles/notch.css`, `src/notch/controls/Scrubber.tsx`), ~20 changed lines
- **Depends on**: 001 (uses `--dur-hover`, `--ease-out`)

## Problem

**1. The thumb is born from `scale(0)`.** The catalog is absolute: "Never
`scale(0)` — nothing in the real world appears from nothing. Target:
`scale(0.9–0.97)` + `opacity: 0`."

```css
/* src/styles/notch.css:352–365 — current */
.scrubber-thumb {
  position: absolute;
  top: 50%;
  left: clamp(0%, calc(var(--p) * 100%), 100%);
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
  background: rgb(var(--paper));
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
  transform: scale(0);
  transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

A 9px playhead is the primary affordance for seeking; on hover it inflates out of a
point, which reads as a glitch rather than a reveal.

**2. The scrubber is the only spring in the app that ignores reduced motion.**
Every other spring goes through `useSpringDriver`, which branches on
`prefersReducedMotion()` (`src/motion/useSpring.ts:32–37`). `Scrubber.tsx` creates
one directly and never imports the helper:

```ts
// src/notch/controls/Scrubber.tsx:117 — current
const spring = new Spring(released, springPresets.momentum, paint);
```

`springPresets.momentum` is `{ response: 0.32, damping: 0.8 }` (`src/motion/spring.ts:21`)
— under-damped, so it overshoots. A reduce-motion user who over-drags the rail
still gets the thumb and fill sliding and bouncing back up to ~30px. This is a
breach of the app's own contract, not a taste call: "movement with no
`prefers-reduced-motion` handling".

**3. The fill animates `width` every frame.** `--p` is written per frame during a
drag (`Scrubber.tsx:48`), and it drives a layout property:

```css
/* src/styles/notch.css:343–349 — current */
.scrubber-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--p) * 100%);
  max-width: 100%;
  border-radius: 99px;
  background: rgb(var(--paper) / 0.9);
}
```

`width` triggers layout + paint + composite. The cost is small (a 3px-tall
absolutely-positioned strip), but a per-frame drag is exactly the case where the
cheap version is available: `scaleX` is composite-only.

## Target

```css
/* target — src/styles/notch.css:352–377 */
.scrubber-thumb {
  position: absolute;
  top: 50%;
  left: clamp(0%, calc(var(--p) * 100%), 100%);
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
  background: rgb(var(--paper));
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
  opacity: 0;
  transform: scale(0.9);
  transition:
    transform var(--dur-hover) var(--ease-out),
    opacity var(--dur-hover) var(--ease-out);
}

/* §2 — the thumb appears the moment a scrub begins, then tracks 1:1. */
.scrubber-track:hover .scrubber-rail,
.scrubber[data-dragging="true"] .scrubber-rail,
.scrubber-track:focus-visible .scrubber-rail {
  height: 4px;
}

.scrubber-track:hover .scrubber-thumb,
.scrubber[data-dragging="true"] .scrubber-thumb,
.scrubber-track:focus-visible .scrubber-thumb {
  opacity: 1;
  transform: scale(1);
}
```

```css
/* target — src/styles/notch.css:343–350 */
.scrubber-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  transform: scaleX(clamp(0, var(--p), 1));
  transform-origin: left center;
  border-radius: 99px;
  background: rgb(var(--paper) / 0.9);
}
```

`clamp(0, var(--p), 1)` preserves the current behaviour exactly: during a
rubber-banded over-drag the thumb travels past the end while the fill stops at
100% (`max-width: 100%` did this before).

```ts
// target — src/notch/controls/Scrubber.tsx, replacing lines 108–126
    const released = displayRef.current;
    const target = clamp01(released);

    // Only a rubber-banded release has somewhere to spring back to.
    if (released !== target) {
      // §14 — a reduce-motion user gets the corrected value in one frame,
      // not a 30px slide back with overshoot.
      if (prefersReducedMotion()) {
        paint(target);
      } else {
        settlingRef.current = true;
        springRef.current?.dispose();
        const spring = new Spring(released, springPresets.momentum, paint);
        springRef.current = spring;
        spring.setTarget(target, velocity / width);
        window.setTimeout(() => {
          settlingRef.current = false;
        }, 450);
      }
    }

    onSeek(target * durationMs);
```

And extend the existing import on `Scrubber.tsx:11`:

```ts
import { Spring, prefersReducedMotion, rubberband, springPresets } from "../../motion/spring";
```

## Repo conventions to follow

- Springs are created through helpers, not by hand — `useSpringDriver` is the
  exemplar (`src/motion/useSpring.ts:32–37`), and it is the pattern this plan
  copies: read the preference, then either animate or snap.
- Comments name the design decision and its `§n`, on the line above the code, as
  in `notch.css:367` ("§2 — the thumb appears the moment a scrub begins").
- Every value written to the DOM in a frame loop goes through a CSS custom property
  on the component root; `--p` here, `--t` in `Notch.tsx`, `--ind-x` in `PageTabs.tsx`.

## Steps

1. Rewrite `.scrubber-thumb` and its three reveal selectors as above (`opacity` +
   `scale(0.9)`, and `transform`/`opacity` transitions on the token pair).
2. Rewrite `.scrubber-fill` to `scaleX(clamp(0, var(--p), 1))` with
   `transform-origin: left center`; delete `max-width`.
3. Add `prefersReducedMotion` to the `Scrubber.tsx` import.
4. Branch `finish()` so a reduced-motion release paints the clamped target
   directly and never constructs the spring.

## Boundaries

- Do NOT change the thumb's `left: clamp(...)`. It stays a percentage-of-track
  position; making it composite would need the track width in pixels, and the cost
  of one 9px absolutely-positioned box is not worth a ResizeObserver.
- Do NOT remove `settlingRef` — it still guards the media clock from overwriting a
  live settle.
- Do NOT add momentum projection on release: `Scrubber.tsx:24–27` documents why a
  seek bar must not project past where the user let go. That comment is a settled
  decision.
- Do NOT touch `.scrubber-rail`'s `transition: height` (plan 001 owns it) or the
  `.scrubber-times` markup.
- Do NOT edit `src/motion/spring.ts`.
- If the quoted code does not match, STOP and report.

## Verification

- **Mechanical**: `npm run build` must pass. Confirm `width: calc(var(--p)` no
  longer appears: `Select-String -Path src\styles\notch.css -Pattern 'calc\(var\(--p\)'`
  should only match the thumb's `left`.
- **Feel check**: `npm run dev`, open `?phase=expanded&page=music`:
  - Hover the rail — the thumb fades and grows from 90% to 100%, it never appears
    as a dot that inflates. Watch it once in DevTools at 10% playback speed.
  - Drag past the right edge and release — the thumb overshoots back with a small
    bounce (damping 0.8) and the fill stays capped at the track end.
  - Drag repeatedly across the rail — the fill must track the pointer with no
    lag or one-frame stutter (it is compositing now, not reflowing).
  - Emulate `prefers-reduced-motion: reduce`, over-drag and release: the thumb
    snaps to the end in one frame with no bounce.
- **Done when**: no `scale(0)` remains anywhere in `src/styles/`, a release under
  reduced motion produces no motion, and the fill never renders wider than the rail.
