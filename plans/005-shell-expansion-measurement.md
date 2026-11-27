# 005 — Shell expansion: measure before touching it

- **Status**: TODO (measurement gate — may close with no code change)
- **Commit**: 9c54427
- **Severity**: MEDIUM (measured-risk)
- **Category**: §5 Performance
- **Estimated scope**: 0 files changed, unless the gate fails; then 1 file (`src/styles/notch.css`)

## Problem

Expand/collapse is the app's signature motion and it is driven by one spring
writing `--t` every frame (`src/notch/Notch.tsx:18`). `--t` drives layout
properties on the shell:

```css
/* src/styles/notch.css:23–30 — current */
.notch-shell {
  position: relative;
  width: calc(152px + 268px * var(--t));
  height: calc(30px + 120px * var(--t));
  border-radius: 0 0 calc(15px + 7px * var(--t)) calc(15px + 7px * var(--t));
```

`width`/`height` trigger layout + paint + composite, and this element contains all
seven always-mounted page subtrees (`ExpandedPanel` is never conditionally
rendered). Two child layers also read the same inherited variable
(`notch.css:80–81`, `142–144`), so each frame invalidates style for the whole
subtree — the catalog's "Don't drive child transforms via a CSS variable on the
parent — it recalcs styles for all children". Inside the resizing region sits
`.notch-tabs` with `backdrop-filter: blur(14px) saturate(160%)` (`:759`), which must
re-blur on every frame in which the backdrop moves.

**Why this plan does not prescribe the fix:** the surface is only 420×150 and the
pages are small. Layout of a few hundred nodes at this size is routinely under 1ms,
and a WebView2 app may well hold 60fps. Asserting jank here without a trace would
be guessing, and the remedy — a fixed-size shell clipped with `inset()` — is a
structural rewrite of the layout that the collapse/expand depends on. Measure
first. Do not restructure a working surface on a hunch.

## Target

**Step 1 decides the plan.** Two outcomes:

- **Gate passes** (no frame over 16.7ms attributable to Layout or Paint, or all such
  frames under 16.7ms): change nothing. Set `Status: CLOSED — measured, no change`
  and append the trace numbers under a `## Result` heading. This is a valid, correct
  outcome — the tradeoff is deliberate and documented, and closing it is the fix.
- **Gate fails**: apply the one inexpensive remedy below and re-measure.

## Repo conventions to follow

- Layout is derived from a single spring value on purpose; `notch.css:4–7` states
  the rationale. Any change must preserve lockstep between size, radius, content
  opacity and sheen.
- `src/motion/spring.ts` is the only motion authority in JS. Do not add rAF loops,
  observers, or a second source of truth for `--t`.

## Steps

1. **Measure.** `npm run dev`, open `?phase=expanded&page=music`. In Chrome/Edge
   DevTools → Performance, set CPU throttling to **4×** and record 10 expand/collapse
   cycles (pointer in, wait for the panel, pointer out). In the trace, read:
   - max frame duration during expansion, and how many frames exceed 16.7ms;
   - the Layout and Paint breakdown for those frames;
   - whether `Recalculate Style` is spiking for the subtree.
   Repeat once in the packaged Tauri window (`npm run tauri dev`) — WebView2 is the
   real target, and it is what ships.
2. **Apply the gate** from the numbers above.
3. **If the gate passes**: stop. Write `## Result` with the numbers and the
   decision. No source change.
4. **If the gate fails**, before restructuring, test the one component with no
   visual purpose: `.notch-tabs`' `backdrop-filter` blurs a near-flat, 96%-opaque
   shell background — behind the tab rail there is nothing but the shell's own
   gradient, so the blur is re-computed every frame for almost no pixels. A/B it:
   take a screenshot of `?phase=expanded&page=settings` in dark and light, remove
   the `backdrop-filter` line (`notch.css:759`), screenshot again, and compare.
   Keep the removal only if the two sets are indistinguishable by eye. Re-measure
   after removing.
5. **Only if both fail**, report back with the trace: the remaining remedy is a
   fixed 420×150 shell clipped by an animated `clip-path: inset(… round …)`, which
   is a layout rewrite and needs its own plan. Do not attempt it here.

## Boundaries

- Do NOT replace the spring with a CSS transition, a `transform: scale()`, or a
  duration — the shell resize is deliberately interruptible and velocity-aware.
- Do NOT add `will-change`, `contain`, or `translateZ` to the shell or its children.
- Do NOT touch `Notch.tsx`, the page pager, or `springPresets.ui`.
- Do NOT change `border-radius`, padding, or the collapsed/expanded dimensions in
  `DESIGN.md` (152×30 / 420×150).
- If measurement is impossible in your environment, report that plainly and leave
  the plan open. Never close it on inference.

## Verification

- **Mechanical**: `npm run build` must pass (it will, if nothing changed).
- **Feel check**: expand and collapse 20 times in a row, quickly and slowly. There
  must be no visible stutter at the start of the expansion (the first frames are
  the most expensive: widest style change, backdrop first painted) and no hitch
  when the content fades in at `--t ≈ 0.45`.
- **Done when**: the plan either carries a `## Result` section with trace numbers
  proving 60fps, or the `backdrop-filter` removal is A/B-verified pixel-identical
  and the trace improved.
