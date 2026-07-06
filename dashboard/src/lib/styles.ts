// DESIGN.md: success green is the only semantic chromatic — strong matches
// get it; everything else walks the neutral surface ladder.
export const SCORE_STYLES = {
  strong: { background: 'rgba(39, 166, 68, 0.15)', color: '#4cc764' },
  mid: { background: 'var(--jp-surface-3)', color: 'var(--jp-ink-muted)' },
  low: { background: 'transparent', color: 'var(--jp-ink-subtle)', border: '1px solid var(--jp-hairline)' },
} as const

// Neutral status-pill treatment (surface lift, no hue) for source/meta chips
export const PILL = { background: 'var(--jp-surface-2)', color: 'var(--jp-ink-subtle)' } as const
