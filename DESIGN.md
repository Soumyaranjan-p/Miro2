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

## Type scale — maximum four sizes

| Step | Size | Weight | Leading | Tracking | Use |
|---|---|---|---|---|---|
| Display | 19px | 600 | 1.05 | -0.02em | timer, water amount |
| Title | 15px | 600 | 1.2 | -0.015em | track title, collapsed brand |
| Body | 12px | 450 | 1.35 | 0 | artist, rows, state copy |
| Label | 10px | 560 | 1.2 | 0.01em | tabs, meta, clock, buttons |

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

`lucide-react` only, at 12px in tabs and 14px in content, stroke width 1.8,
round caps, currentColor. No emoji, no Unicode glyph substitutes, no mixed
hand-drawn sets.

## States and scope

Collapsed (152×30), hover (152×30 with a lit rim), expanded (420×150) in dark
and light. Pages: Music, Lyrics, Focus, Water, Shelf, To-do, Settings.
Window geometry and Rust code are out of scope. The name stays **Miro**; no
Nusa text, icons, or assets.
