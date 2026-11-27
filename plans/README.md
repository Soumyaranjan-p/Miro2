# Miro — animation plans

Produced by the `improve-animations` audit at commit `9c54427`, against
`.claude/skills/improve-animations/AUDIT.md` (Emil Kowalski's rule catalog).
Source code was not modified. Each plan is self-contained: exact paths, current
code, target values, ordered steps, boundaries, and a feel check.

Execute one with `improve-animations execute plans/00N-….md`, or hand the file to
any agent — they are written for an executor with zero context and no taste.

## Plans

| # | Title | Severity | Categories | Files | Depends on |
|---|---|---|---|---|---|
| 001 | [Motion tokens, then control feedback](001-motion-tokens-and-control-feedback.md) | MEDIUM | §7 §2 §3 §6 | `tokens.css`, `notch.css` | — |
| 002 | [Scrubber: no `scale(0)`, reduced-motion settle, composite fill](002-scrubber.md) | MEDIUM | §3 §6 §5 | `notch.css`, `Scrubber.tsx` | 001 |
| 003 | [Lyrics track: 280ms, ease-out](003-lyrics-track.md) | MEDIUM | §2 | `notch.css` | 001 |
| 004 | [Water fill: composite the level, under 300ms](004-water-fill.md) | MEDIUM | §5 §2 | `notch.css`, `WaterPage.tsx` | 001 |
| 005 | [Shell expansion: measure before touching it](005-shell-expansion-measurement.md) | MEDIUM (measured-risk) | §5 | none, unless the gate fails | — |
| 006 | [Water goal arrival: one sheen](006-water-goal-arrival.md) | LOW (optional, additive) | §8 | `WaterPage.tsx`, `notch.css` | 004 |

**Recommended order: 001 → 002 → 003 → 004 → 005 → 006.**

001 must land first: it introduces `--ease-out`, `--ease-in-out`, `--dur-press`,
`--dur-hover`, `--dur-state`, `--dur-move` in `src/styles/tokens.css`, which 002,
003 and 004 reference. 006 depends on 004 only because both rewrite `.bottle-fill`
geometry; 006 can be skipped entirely without affecting the others. 005 is
independent and may legitimately close with no code change.

## What the audit found

Six planned items plus three findings deliberately left alone (below). The motion
core is in good shape and should not be touched: one spring drives the shell so
size, radius, content opacity and sheen stay in lockstep; the page strip is a
single continuous cursor that re-targets from its live value; a swipe pauses the
spring and returns the finger's velocity; `Scrubber` correctly refuses momentum
projection on release. There are zero `@keyframes` on interactive surfaces, zero
`transition: all`, zero `will-change`, and the JS reduced-motion handling is
correct in `useSpringDriver` and `PageStage` — one-shot read, live `matchMedia`
listener, snap-to-target, drag disabled.

The defects are all in the CSS layer around that core: nine hand-typed durations and
six easing expressions with no tokens (§7), press feedback at 90ms instead of the
100–160ms band, press depths of 0.88–0.94 instead of 0.95–0.98, a switch knob that
teleports because it animates `left` with no transition at all, a playhead born from
`scale(0)`, a lyric scroll at 1.4× the duration budget, a water level transitioned
by `height` for 560ms, and one spring (the scrubber's settle) that bypasses the
app's own reduced-motion contract.

## Findings not planned

| Finding | Where | Why no plan |
|---|---|---|
| Arrow-key paging runs the full 268px slide | `PageTabs.tsx:88` → `PageStage.tsx:162` | §1 says keyboard-initiated, tens-a-day navigation should "remove or drastically reduce". Defensible, but a spatial pager that slides on click and snaps on arrow key is its own inconsistency, and the fix (a `snap` flag through two components) is a design decision, not a cleanup. Ask before spending it. |
| Theme switch inverts every surface in one frame | `SettingsPage.tsx:52` | A crossfade would be pleasant, but the surfaces are gradients and `box-shadow` stacks; CSS cannot transition them, and a JS colour interpolation is out of scope for a CSS-only fix. Low frequency, deliberate action. |
| Segmented control has no moving indicator | `notch.css:885` | Its press feedback and its colour swap are handled in 001. A sliding pill is not: it would duplicate the tab bar's spring indicator 20px below it, and two indicators moving independently in a 150px panel is more motion than the brief ("nothing shouts"). |
| Scrubber thumb position animates `left` (layout) | `notch.css:355` | Making it composite needs the track width in pixels; the element is 9×9px. Cost is not worth a `ResizeObserver`. Recorded in 002's boundaries. |
| `.focus-progress` transitions `stroke-dashoffset` for 900ms | `notch.css:479` | Correct: linear progress that re-targets on every tick. Genuinely constant motion, and the catalog assigns `linear` to it. |

## Scope of the audit

Every file under `src/notch/`, `src/motion/`, `src/styles/`, `src/app/` was read in
full; the audit was run as two independent read-only passes (categories 1–4 and 5–8)
and every finding was re-verified at its `file:line` before being written here.
No performance trace was taken — the one performance claim that needs one is gated
inside plan 005 rather than asserted.
