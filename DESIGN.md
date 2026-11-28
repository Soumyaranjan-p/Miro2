# Miro — DESIGN.md

Visual authority for the Miro notch UI. Product truth lives in `PRODUCT.md`;
this file owns the durable visual decisions. Every pass of the redesign works
from it.

## Visual direction

**A quiet instrument on the top edge.** Miro sits at the notch: glanceable,
precise, and spatially honest. Composition is a two-zone arrangement — content
on the left, meta/actions on the right — inside one continuous surface. Nothing
shouts. The accent is used only for state that changes (playing, progress,
current round, water, completed tasks).

Use scene: a desktop user glances up for a second while working. Dark is the
default because the notch sits against a screen bezel; light is for bright rooms
and light wallpapers. Both are first-class.

## Color tokens

One accent family, tuned per theme for contrast. All other colors are the
surface and its foreground; no second hue.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--ink` | `9 10 12` | `250 249 246` | surface base |
| `--paper` | `244 242 236` | `22 24 28` | foreground base |
| `--accent` | `199 242 132` | `98 148 48` | state, progress, current |
| `--text-primary` | paper / 96% | paper / 94% | titles, numbers |
| `--text-secondary` | paper / 70% | paper / 66% | supporting copy |
| `--text-tertiary` | paper / 48% | paper / 46% | meta, inactive |
| `--text-on-light` | `12 13 15` | `250 249 246` | type on filled pills |
| `--surface-raised` | paper / 6% | paper / 5% | tabs, icon wells |
| `--hairline` | paper / 7% | paper / 8% | quiet separators |

Never tint secondary text with neutral gray that is unrelated to the
foreground; derive it from `--paper`.

## Type — Inter, one source of truth

**Inter** is the app's only family, bundled locally as a variable font
(`src/assets/fonts/InterVariable.woff2`, OFL license ships beside it). No CDN,
no second family; Segoe UI remains the Windows fallback chain. Sizes, weights,
leadings, and tracking exist once as `--type-*` tokens in `tokens.css` and are
consumed only through the `.t-*` classes — no component sets its own font
values.

| Step | Size | Weight | Leading | Tracking | Use |
|---|---|---|---|---|---|
| Display | 19px | 600 | 1.05 | -0.02em | timer, water amount |
| Title | 15px | 600 | 1.2 | -0.015em | track title, glance percentages |
| Body | 12px | 450 | 1.35 | 0 | artist, rows, state copy |
| Label | 10px | 560 | 1.2 | 0.01em | meta, clock, buttons, captions |

`--type-meta-size` is retired; meta uses the Label step. Optical sizing is on.
Tabular numerals for every clock, timer, progress, and count.

## Spacing — 4/8 grid

Allowed steps: 4, 8, 12, 16, 24px. Shell padding is 12px horizontal / 9px top /
7px bottom. Tight groups use 4px; related groups use 8px; page zones use 12px;
the clock gutter is 44px. No ad-hoc pixel gaps.

## Radius and material

- Shell: 15px collapsed → 22px expanded, bottom corners only (fixed by the
  window contract).
- Artwork: 10px. Rows and wells: 6px. Buttons/pills: 999px.
- Tabs rail: 8px; active indicator: 6px.
- One surface, layered inside it: a base fill plus a raised interactive layer.
  Translucency and blur are material decisions for Pass 2, not decoration here.
- Depth comes from a rim and offset shadow on the raised layer; no hard offset
  blocks, no colored glow except the live-state dot.

## Icons

`lucide-react` only, at 13px in tabs and 14px in content, stroke width 1.8,
round caps, currentColor. No emoji, no Unicode glyph substitutes, no mixed
hand-drawn sets.

## Navigation — icon-only

The tab rail carries nine pages: Music, Widgets, Usage, Focus, Water, Shelf,
To-do, System, Settings. Tabs are icons only — the page name lives in the
accessible name and a tooltip that appears on hover (delayed 400 ms so a
sweep across the rail does not strobe) and instantly on keyboard focus. Tab
hit areas are 44px wide and fill the 22px rail; the notch's fixed 420×150
window caps the vertical hit area at the rail height. Hover styling sits
behind `@media (hover: hover)`.

## Transient states — overlays, never sections

Charging and Bluetooth headphones connect/disconnect play a short card inside
the notch and dismiss themselves (2.6-3 s). The layer is pointer-events: none,
enters from the top edge and exits along the same path with a faster exit, and
condenses to a single line when the notch is collapsed. They never appear in
navigation.

## States and scope

Collapsed (152×30), hover (152×30 with a lit rim), expanded (420×150) in dark
and light. Pages: Music (with split Lyrics), Widgets, AI Usage, Focus, Water,
Shelf, To-do, System, Settings. Window geometry is fixed; Rust changes exist
only to feed the UI (system stats, power, Bluetooth, SMTC seek). The name
stays **Miro**; no Nusa text, icons, or assets.
