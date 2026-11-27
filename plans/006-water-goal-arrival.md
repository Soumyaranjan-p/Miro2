# 006 — Water goal arrival: spend the one delight moment the day allows

- **Status**: TODO (optional, additive)
- **Commit**: 9c54427
- **Severity**: LOW
- **Category**: §8 Missed opportunities
- **Estimated scope**: 2 files (`src/notch/pages/WaterPage.tsx`, `src/styles/notch.css`), ~25 lines
- **Depends on**: 004 (the level must already be `scaleY`, so the sheen is not
  fighting a reflowing fill)

## Problem

Reaching the daily water goal happens **once a day** — in the catalog's frequency
map that is the "rare / first-time" row, the one bucket allowed to "add delight".
Today it gets a string swap and a disabled button:

```tsx
// src/notch/pages/WaterPage.tsx:44–50 — current
      <button
        type="button"
        className="drink-button t-label"
        onClick={drink}
        disabled={reached}
      >
        {reached ? "Done" : `Drink ${water.bottleMl} ml`}
      </button>
```

The bottle finishes its fill and nothing acknowledges it. This is a missed
opportunity, not a defect: the app is otherwise disciplined enough that one
restrained flourish at the only celebratory moment in its day will read as craft
rather than noise.

## Target

One gesture, not three: a single sheen sweep across the glass, 620ms, once, on the
false→true transition of `reached`.

```css
/* target — src/styles/notch.css, appended after the .bottle-fill rule */

.bottle {
  position: relative;
  overflow: hidden;
  /* …existing declarations unchanged… */
}

/* §8 — the one rare moment in the day earns one gesture: light crossing the
   glass. Keyframes are correct here precisely because this fires once, not
   on a rapidly-triggered surface (§4). */
.bottle::after {
  content: "";
  position: absolute;
  inset: -30% -140%;
  background: linear-gradient(
    105deg,
    transparent 42%,
    rgb(255 255 255 / 0.22) 50%,
    transparent 58%
  );
  opacity: 0;
  pointer-events: none;
}

.water-page[data-arrived="true"] .bottle::after {
  opacity: 1;
  animation: bottle-sheen 620ms var(--ease-out);
}

@keyframes bottle-sheen {
  from {
    transform: translateX(-55%);
  }
  to {
    transform: translateX(55%);
  }
}
```

Reduced motion — the state text still changes, the sweep does not:

```css
/* inside the existing @media (prefers-reduced-motion: reduce) block */
  .water-page[data-arrived="true"] .bottle::after {
    animation: none;
    opacity: 0;
  }
```

And the trigger. The `useEffect` must sit **above** the `goalMl <= 0` early return —
React requires hooks to run unconditionally — so the guards move up with it:

```tsx
// target — src/notch/pages/WaterPage.tsx, replacing lines 15–22 and 31
  const { snapshot, drink } = useModel();
  const water = snapshot.water;

  const hasGoal = water.goalMl > 0;
  const ratio = hasGoal ? Math.min(1, water.todayMl / water.goalMl) : 0;
  const reached = hasGoal && ratio >= 1;

  const [arrived, setArrived] = useState(false);
  const reachedRef = useRef(reached);

  useEffect(() => {
    const wasReached = reachedRef.current;
    reachedRef.current = reached;
    if (!reached || wasReached) return undefined;
    setArrived(true);
    const timer = window.setTimeout(() => setArrived(false), 700);
    return () => window.clearTimeout(timer);
  }, [reached]);

  if (!hasGoal) {
    return (
      <EmptyState title="No goal set" hint="Choose a daily goal in settings." />
    );
  }
```

and the root becomes:

```tsx
    <div className="water-page" data-arrived={arrived ? "true" : undefined}>
```

## Repo conventions to follow

- State that is visual-only rides a `data-*` attribute, never a class name:
  `data-dragging` (`Scrubber.tsx:174`), `data-playing` (`CollapsedPill.tsx:15`),
  `data-done` (`TodoPage.tsx:23`). This plan follows that.
- Animation is one-shot and self-clearing; nothing persists in state after it ends.
- Comments name the decision and its `§n`, on the line above, as elsewhere.
- `EmptyState` is shared and unchanged — keep using it.

## Steps

1. Add `position: relative` and `overflow: hidden` to `.bottle`, plus the `::after`
   rules and the keyframes, in `notch.css` after `.bottle-fill`.
2. Add the reduced-motion override inside the existing block at the end of the file.
3. In `WaterPage.tsx`: add `useEffect`, `useRef`, `useState` to the React import;
   hoist `hasGoal` / `ratio` / `reached` above the early return; add the arrival
   effect; switch the early return to `if (!hasGoal)`.
4. Add `data-arrived` to the page root.

## Boundaries

- Do NOT add a second gesture (no scale bump on the number, no colour flash on the
  button, no sound). One sweep.
- Do NOT animate the button's disabled state, change its label timing, or delay
  `drink()`.
- Do NOT reuse this sheen anywhere else — it is spent currency at one moment.
- Do NOT make the sweep loop, or keep it in the DOM after 700ms (`arrived` must
  return to `false`).
- Do NOT touch the focus ring, the todo list, or any other page.
- If the quoted code does not match, STOP and report.

## Verification

- **Mechanical**: `npm run build` must pass. No React hooks-order warning in the
  console when the page opens with `goalMl` at 0 and again with a goal set.
- **Feel check**: `npm run dev`, `?phase=expanded&page=water` with a low goal so one
  press reaches it:
  - Press the drink button — the level rises, the label becomes "Done", and one soft
    band of light crosses the glass in step with the fill finishing, not after it.
  - Press again (button is disabled) — nothing replays.
  - Reload with the goal already met — no sweep on mount. It must fire only on the
    transition, never on first paint.
  - In DevTools → Animations at 10% playback, confirm the band enters and exits the
    bottle without a visible edge popping at either end (`inset: -30% -140%` is what
    keeps it hidden while it travels).
  - Emulate `prefers-reduced-motion: reduce` — no sweep, label still changes.
- **Done when**: the sweep fires exactly once per goal arrival, is invisible on
  mount, and leaves no animation state behind.
