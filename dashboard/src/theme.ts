import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core'

// DESIGN.md tokens — Linear dark system. Single source of truth for JS-side
// values; the same tokens exist as --jp-* custom properties in theme.css.

// Lavender-blue ramp around #5e6ad2 (index 6 = primary, 4 = hover)
const lavender: MantineColorsTuple = [
  '#eceefc',
  '#d9dcf7',
  '#b3b9ee',
  '#98a2f0',
  '#828fff', // primary-hover
  '#6f7ade',
  '#5e6ad2', // primary
  '#5e69d1', // primary-focus
  '#4f58ae',
  '#414890',
]

// Surface ladder + ink scale mapped onto Mantine's dark ramp:
// 0-3 text (ink → ink-tertiary), 4 hairline, 5-7 surfaces, 7 = canvas/body.
const dark: MantineColorsTuple = [
  '#f7f8f8', // ink
  '#d0d6e0', // ink-muted
  '#8a8f98', // ink-subtle (dimmed)
  '#62666d', // ink-tertiary
  '#23252a', // hairline (default borders)
  '#191a1c', // surface-3
  '#0f1011', // surface-1 (inputs, cards)
  '#010102', // canvas
  '#0a0a0b',
  '#010102',
]

export const theme = createTheme({
  fontFamily:
    "'Inter Variable', 'SF Pro Display', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  primaryColor: 'lavender',
  primaryShade: 6,
  colors: { lavender, dark },
  defaultRadius: 'md', // 8px — buttons, inputs
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '40px', lineHeight: '1.15' },
      h2: { fontSize: '28px', lineHeight: '1.2' },
      h3: { fontSize: '22px', lineHeight: '1.25' },
      h4: { fontSize: '18px', lineHeight: '1.3' },
    },
  },
  components: {
    Card: { defaultProps: { radius: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: {
      defaultProps: {
        radius: 'lg',
        overlayProps: { color: '#000000', backgroundOpacity: 0.6 },
      },
      styles: {
        content: { backgroundColor: 'var(--jp-surface-1)', border: '1px solid var(--jp-hairline)' },
        header: { backgroundColor: 'var(--jp-surface-1)' },
      },
    },
    Drawer: {
      defaultProps: { overlayProps: { color: '#000000', backgroundOpacity: 0.6 } },
      styles: {
        content: {
          backgroundColor: 'var(--jp-surface-1)',
          borderTop: '1px solid var(--jp-hairline)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        },
        header: { backgroundColor: 'var(--jp-surface-1)' },
      },
    },
    Button: { defaultProps: { radius: 'md' } },
    Badge: { styles: { root: { textTransform: 'none', fontWeight: 500 } } },
  },
})

// Mantine derives most component colors from these; overriding here keeps the
// whole library on the DESIGN.md ladder without per-component styling.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    '--mantine-color-body': '#010102',
    '--mantine-color-text': '#f7f8f8',
    '--mantine-color-dimmed': '#8a8f98',
    '--mantine-color-placeholder': '#62666d',
    '--mantine-color-default': '#0f1011',
    '--mantine-color-default-hover': '#141516',
    '--mantine-color-default-border': '#23252a',
    '--mantine-color-default-color': '#f7f8f8',
  },
})
