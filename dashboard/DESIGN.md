# JobPilot Dashboard — Design System (Linear dark)

> Adopted from the Linear marketing design spec provided by the owner.
> The dashboard implements these tokens in `src/theme.ts` (Mantine theme +
> CSS-variable resolver) and `src/theme.css` (raw tokens + overrides).

## Overview

Linear's marketing canvas is the deepest dark surface in this collection — `{colors.canvas}` is #010102, essentially pure black with a faint blue tint. On top sits a four-step surface ladder (`{colors.surface-1}` through `{colors.surface-4}`) for cards, panels, and lifted tiles, with hairline borders running from `{colors.hairline}` (#23252a) up through `{colors.hairline-strong}` and `{colors.hairline-tertiary}`. Light gray text (`{colors.ink}` #f7f8f8) carries the body and headlines.

The single chromatic accent is **Linear lavender-blue** `{colors.primary}` (#5e6ad2) — used on the brand mark, focus rings, and the primary CTA button. A lighter hover state (`{colors.primary-hover}` #828fff) and a focus-tinted variant (`{colors.primary-focus}` #5e69d1) extend the same hue. Linear avoids saturated greens, oranges, reds, etc. on the marketing canvas — the only semantic color is `{colors.semantic-success}` (#27a644) for status pills and the rare success indicator.

Display type runs Linear's custom sans (with `SF Pro Display` fallback) at weight 500–700 with negative letter-spacing scaling from -3.0px at 80px down to 0 at body. The body family is Linear's text cut, and a Linear Mono is reserved for code snippets in product screenshots.

**Key Characteristics:**
- **Dark-canvas system** — `{colors.canvas}` (#010102), near-pure black with a faint blue tint. Never `#000000` true black.
- **Lavender-blue brand accent** (`{colors.primary}` #5e6ad2) — used scarcely on brand mark, focus, and the primary CTA.
- Four-step surface ladder (canvas → surface-1 → surface-2 → surface-3 → surface-4) carries hierarchy without shadow.
- Display tracking pulls aggressively negative; body holds at -0.05px.
- Cards use `{rounded.lg}` 12px corners with 1px hairline borders — never pill, rarely 16px.
- The **job table is the product UI protagonist** — it sits in a `{rounded.xl}` 16px surface-1 panel; the chrome around it is minimal.
- No second chromatic color. No atmospheric gradients. No spotlight cards. No drop shadows.

## Colors

### Brand & Accent
- **Lavender-Blue** (`--jp-primary` #5e6ad2): primary CTA, brand mark, focus, link emphasis.
- **Lavender Hover** (`--jp-primary-hover` #828fff): hovered state of the primary CTA.
- **Lavender Focus** (`--jp-primary-focus` #5e69d1): focus-ring tint — focused inputs, focused buttons.

### Surface
- **Canvas** (`--jp-canvas` #010102): default page background.
- **Surface 1** (`--jp-surface-1` #0f1011): cards, inputs, panels — one step above canvas.
- **Surface 2** (`--jp-surface-2` #141516): lifted/hovered surfaces, neutral pills.
- **Surface 3** (`--jp-surface-3` #191a1c): sub-nav, dropdown menus.
- **Surface 4** (`--jp-surface-4` #1f2023): deepest lifted surface.
- **Hairline** (`--jp-hairline` #23252a): 1px borders on cards and dividers.
- **Hairline Strong** (`--jp-hairline-strong` #34363c): stronger 1px borders — focused input border.

### Text
- **Ink** (`--jp-ink` #f7f8f8): headlines and emphasized body.
- **Ink Muted** (`--jp-ink-muted` #d0d6e0): secondary type.
- **Ink Subtle** (`--jp-ink-subtle` #8a8f98): tertiary type, deselected states.
- **Ink Tertiary** (`--jp-ink-tertiary` #62666d): disabled, footnotes, placeholders.

### Semantic
- **Success Green** (`--jp-success` #27a644): the ONLY semantic chromatic — high match scores, success alerts. (Error red is permitted for functional error states only — a documented gap in the source spec.)

## Typography

- **Family**: `Inter Variable` (closest free substitute for Linear's custom sans), falling back to `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto`.
- Display/headline weight 600, body weight 400. Never 700+ display.
- Negative tracking scales with size: -1.0px at 40px, -0.6px at 28px, -0.4px at 22px, -0.05px at body 16px/14px.
- Eyebrow/meta text uses slight positive tracking (+0.4px) as taxonomy contrast.
- Buttons: 14px / 500 / 1.20.
- Numbers in the score column render `tabular-nums`.

## Layout & Shape

- Base spacing unit 4px; card interior padding 24px; compact button padding 8px × 14px; input padding 8px × 12px.
- Radius scale: 4px chips · 6px tags · **8px buttons/inputs** · **12px cards** · **16px product panels** · 9999px pills/avatars.
- Max content width ~1280px.
- The dark canvas IS the whitespace: sections separate by surface lift, not gaps.

## Elevation

| Level | Treatment |
|---|---|
| 0 | Flat on canvas — body type, header, footer |
| 1 | surface-1 + 1px hairline — default cards, the job table panel |
| 2 | surface-2 + 1px hairline-strong — hovered rows, featured tiles |
| 3 | surface-3 — dropdown menus |
| 4 | 2px `--jp-primary-focus` outline at 50% opacity — focus ring |

Depth = surface ladder + hairlines. No drop shadows. Lifted panels get a subtle top edge highlight (`inset 0 1px 0 rgba(255,255,255,.04)`).

## Do / Don't

**Do**: reserve lavender for brand mark, primary CTA, focus ring; use the surface ladder without skipping levels; pair display 600 with body 400; apply negative display tracking; give CTAs 8px corners.

**Don't**: ship a light mode; use lavender as a fill/background; introduce a second chromatic accent (orange, yellow, pink); add gradients or drop shadows; pill-round CTAs; use `#000000` true black.
