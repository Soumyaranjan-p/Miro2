# 001 — Name the motion vocabulary, then fix control feedback

- **Status**: TODO
- **Commit**: 9c54427
- **Severity**: MEDIUM
- **Category**: §7 Cohesion & tokens, §2 Easing & duration, §3 Physicality, §6 Accessibility
- **Estimated scope**: 2 files (`src/styles/tokens.css`, `src/styles/notch.css`), CSS only, ~18 small edits

## Problem

Every curve and duration in the app is hand-typed at its use site, and the values
disagree with the rule catalog in four ways.

**1. No motion tokens at all.** `src/styles/tokens.css` defines colour, space,
radius and type — and zero motion. Meanwhile `src/styles/notch.css:7` claims
"Motion itself lives in `src/motion/spring.ts`, not in CSS transitions", while 13
transition sites use **9 distinct durations** (90/140/160/180/220/300/420/560/900ms)
and **6 easing expressions**, including three beziers within 0.02 of each other:

```css
/* src/styles/notch.css:363, 414, 579 — three curves that almost match */
transition: transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
transition: transform 420ms cubic-bezier(0.22, 0.9, 0.24, 1);
transition: height 560ms cubic-bezier(0.22, 1, 0.36, 1);
```

The JS side already solves this: `src/motion/spring.ts:13` has three named
presets (`ui`, `momentum`, `tab`). CSS should mirror that discipline.

**2. Press feedback is 90ms, below the catalog band** — "Button press feedback |
100–160ms". Four controls share the same under-spec value:

```css
/* src/styles/notch.css:280, 592, 701, 799 — .icon-button, .drink-button, .todo-check, .tab */
    transform 90ms ease-out;
```

**3. Press depth is outside 0.95–0.98** — the catalog says "Keep it subtle
(0.95–0.98)". `0.92` (`:296`), `0.94` (`:312`), `0.88` (`:712`). A 16px checkbox
scaled to 0.88 is a ~2px collapse; it reads as a squash, not a press.

**4. Two pressables have no press state, and the switch knob teleports.**
`.segmented button` (`:873`) and `.switch` (`:890`) carry no `:active` rule.
Worse, the switch knob moves by animating `left` — and declares no transition at
all, so it jumps 12px in a single frame on every toggle:

```css
/* src/styles/notch.css:902–921 — current */
.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.switch[aria-checked="true"]::after {
  left: 14px;
  background: var(--ink);
}
```

`.segmented button[aria-pressed="true"]` also swaps its pill background in one
frame (`:885`), while the tab bar 20px above it slides on two springs — two
visually twin selectors behaving in opposite ways.

**5. The reduced-motion block misses every transform-based press.** It gates
`lyrics-track`, `bottle-fill`, `focus-progress`, `scrubber-thumb`, `scrubber-rail`
(`:951–958`) but not the four press scales, so a reduce-motion user still gets
4–12% scale pops on the most-repeated interaction in the app.

## Target

Add the motion vocabulary to `src/styles/tokens.css`, inside the existing `:root`
block, immediately after `--material-blur: 14px;`:

```css
  /* §6 — reduced transparency must still leave a legible surface. */
  --material-blur: 14px;

  /* Motion — one vocabulary, named once. UI stays under 300ms; press feedback
     lives in the 100–160ms band. Springs live in src/motion/spring.ts. */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

  --dur-press: 120ms;
  --dur-hover: 140ms;
  --dur-state: 180ms;
  --dur-move: 280ms;
```

Do **not** duplicate these in `:root[data-theme="light"]` (`tokens.css:79`) — motion
is theme-independent.

Then substitute, exactly:

| File:line | Current | Target |
|---|---|---|
| `notch.css:59` | `transition: opacity 140ms ease-out;` | `transition: opacity var(--dur-hover) var(--ease-out);` |
| `notch.css:100–102` | `background-color 220ms ease, box-shadow 220ms ease;` | `background-color var(--dur-state) ease, box-shadow var(--dur-state) ease;` |
| `notch.css:277–281` | `background-color 140ms ease-out, color 140ms ease-out, transform 90ms ease-out;` | `background-color var(--dur-hover) var(--ease-out), color var(--dur-hover) var(--ease-out), transform var(--dur-press) var(--ease-out);` |
| `notch.css:296` | `transform: scale(0.92);` | `transform: scale(0.96);` |
| `notch.css:312` | `transform: scale(0.94);` | `transform: scale(0.96);` |
| `notch.css:340` | `transition: height 140ms ease-out;` | `transition: height var(--dur-hover) var(--ease-out);` |
| `notch.css:432–435` | `color 300ms ease, opacity 300ms ease;` | `color var(--dur-state) ease, opacity var(--dur-state) ease;` |
| `notch.css:590–593` | `background-color 140ms ease-out, transform 90ms ease-out;` | `background-color var(--dur-hover) var(--ease-out), transform var(--dur-press) var(--ease-out);` |
| `notch.css:698–701` | `background-color 160ms ease, border-color 160ms ease, transform 90ms ease-out;` | `background-color var(--dur-hover) ease, border-color var(--dur-hover) ease, transform var(--dur-press) var(--ease-out);` |
| `notch.css:712` | `transform: scale(0.88);` | `transform: scale(0.96);` |
| `notch.css:797–800` | `color 180ms ease-out, transform 90ms ease-out;` | `color var(--dur-state) var(--ease-out), transform var(--dur-press) var(--ease-out);` |
| `notch.css:948` | `transition: opacity 180ms ease;` | `transition: opacity var(--dur-state) ease;` |

Keep the bare `ease` on `--collapsed-dot` and `.lyric` colour: the catalog assigns
`ease` to hover and colour change. Do not "unify" those to `--ease-out`.

The switch, in full:

```css
/* target — notch.css, replacing lines 902–921 */
.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-secondary);
  transform: translateX(0);
  transition:
    transform var(--dur-state) var(--ease-out),
    background-color var(--dur-state) var(--ease-out);
}

.switch[aria-checked="true"]::after {
  transform: translateX(12px);
  background: var(--ink);
}
```

The track and the segmented buttons:

```css
/* target — notch.css */
.switch {
  /* …existing declarations unchanged… */
  transition:
    background-color var(--dur-state) var(--ease-out),
    transform var(--dur-press) var(--ease-out);
}

.switch:active {
  transform: scale(0.96);
}

.segmented button {
  /* …existing declarations unchanged… */
  transition:
    background-color var(--dur-state) var(--ease-out),
    color var(--dur-state) var(--ease-out),
    transform var(--dur-press) var(--ease-out);
}

.segmented button:active {
  transform: scale(0.96);
}
```

And the reduced-motion guard, appended inside the existing
`@media (prefers-reduced-motion: reduce)` block (`notch.css:944`), after the
`.lyrics-track, …` rule and before its closing brace:

```css
  /* §14 — keep colour feedback, drop the movement (§6: "keep opacity/color,
     drop movement"). Overriding transition-property removes transform without
     silencing the state change. */
  .icon-button,
  .drink-button,
  .todo-check,
  .tab,
  .segmented button,
  .switch {
    transition-property: color, background-color, border-color, box-shadow;
  }

  .switch::after {
    transition-duration: 0.01ms;
  }
```

## Repo conventions to follow

- Tokens live in one `:root` block in `src/styles/tokens.css`, grouped by purpose
  (`--space-*`, `--radius-*`, `--type-*`), each group carrying a `§n` comment
  naming the design decision it implements. `--space-1: 4px;` at `tokens.css:58`
  is the shape to imitate.
- Long property lists are written one property per line, trailing comma, values as
  `property duration timing-function` — see `notch.css:277`.
- Transitions only. No `@keyframes` exists in this file and none may be added here.

## Steps

1. Add the motion token block to `tokens.css` `:root` as above.
2. Apply the substitution table, in file order, top to bottom.
3. Rewrite `.switch::after` / `.switch[aria-checked="true"]::after`; delete the
   `left: 14px` line, do not keep both mechanisms.
4. Add `transition` and `:active` to `.switch` and `.segmented button`.
5. Append the reduced-motion guard.

## Boundaries

- Do NOT touch `.scrubber-thumb` (`:352–377`), `.lyrics-track` (`:411–417`) or
  `.bottle-fill` (`:571–580`) transitions — plans 002, 003 and 004 own those
  declarations, including the curves inside them.
- Do NOT change `.focus-progress`'s `900ms linear` (`:479`): linear progress that
  re-targets every tick is correct and cannot be expressed as a token.
- Do NOT change markup, class names, or the `aria-*` contract.
- Do NOT add `@keyframes`, `will-change`, or any dependency.
- Do NOT edit `src/motion/*` — the spring engine is correct and out of scope.
- If a line number does not match the code you find, STOP and report instead of
  improvising.

## Verification

- **Mechanical**: `npm run build` — must pass (`tsc && vite build`). Then
  `Select-String -Path src\styles\notch.css -Pattern '\d+ms'` and confirm every
  remaining hit is one of: `0.01ms`, `900ms`, or a `var(--dur-*)` reference.
- **Feel check**: `npm run dev`, then `?phase=expanded&page=settings`:
  - Toggle "Minimal notch" — the knob slides 12px over ~180ms, no jump, and the
    track colour arrives with it.
  - Press and hold a theme segment — it shrinks to 0.96 and the shrink lands while
    the pointer is still down, not on release.
  - Press the play button on the music page — the squash is visible but shallow;
    at 0.96 you should not see the icon lose legibility.
  - In DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: pressing
    any control must still change colour, but must not scale.
- **Done when**: no literal duration other than `0.01ms` and `900ms` remains in
  `notch.css`; the switch knob animates; all six controls respond to `:active`.
