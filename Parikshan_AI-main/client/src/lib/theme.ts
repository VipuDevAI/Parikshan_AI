/**
 * Parikshan.AI - Smart Emerald Design System
 * Unified theme tokens for consistent styling across the application
 */

export const colors = {
  brand: {
    primary: '#166534',
    accent: '#22C55E',
    light: '#4ADE80',
    dark: '#14532D',
  },
  neutrals: {
    background: '#F9FAFB',
    backgroundDark: '#0F172A',
    text: '#111827',
    textMuted: '#6B7280',
    textLight: '#9CA3AF',
    border: '#E5E7EB',
    borderDark: '#1F2937',
  },
  alerts: {
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    success: '#22C55E',
    successLight: '#DCFCE7',
  },
  gradients: {
    dashboard: 'linear-gradient(135deg, #0F172A 0%, #022C22 45%, #166534 100%)',
    dashboardLight: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #BBF7D0 100%)',
    primary: 'linear-gradient(135deg, #166534 0%, #14532D 100%)',
    accent: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    glassDark: 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%)',
    sidebar: 'linear-gradient(180deg, #0F172A 0%, #022C22 100%)',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Outfit', 'Inter', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 20px rgba(34, 197, 94, 0.15)',
  glowStrong: '0 0 40px rgba(34, 197, 94, 0.25)',
  glowAccent: '0 0 30px rgba(34, 197, 94, 0.2)',
  card: '0 4px 20px rgba(0, 0, 0, 0.08)',
  cardHover: '0 8px 30px rgba(0, 0, 0, 0.12)',
  glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
  bounce: '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export const zIndex = {
  dropdown: 50,
  sticky: 100,
  modal: 200,
  popover: 300,
  toast: 400,
  tooltip: 500,
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  transitions,
  zIndex,
} as const;

export default theme;
