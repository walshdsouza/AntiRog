import { Platform, type BoxShadowValue, type ColorValue } from 'react-native';

/*
 * Neumorphic (soft UI) design tokens: charcoal, sand and electric blue.
 *
 * Roles, so color always means the same thing:
 *  - `canvas`: every surface - sand in light mode, charcoal in dark mode. Cards are the canvas lifted
 *    by two shadows (light up-left, dark down-right); wells are the canvas pressed in.
 *  - `ink` / `primary`: text, and the filled main action on a screen - charcoal on sand, or sand on
 *    charcoal in dark mode.
 *  - electric blue `accent`: whatever is interactive or active - secondary buttons, links, the
 *    selected tab or segment, switches that are on.
 *  - `outline`: visible edges for inputs, off switches and secondary buttons (3:1 against the canvas),
 *    so controls never depend on soft shadows alone.
 *  - danger / success / warning: status only, never decoration.
 *
 * Every text/background pairing used is WCAG AA (4.5:1 for text, 3:1 for placeholders and control
 * edges) in both schemes. The color names are also Tailwind colors (tailwind.config.js); keep the two
 * in sync.
 */

export type Scheme = 'light' | 'dark';

export type Palette = {
  canvas: string;
  /** Up-left highlight. */
  highlight: string;
  /** Down-right shadow. */
  shadow: string;
  /** Hairline used where shadows can't render (old Android) and on tinted cards. */
  hairline: string;
  /** Visible control edge: inputs, off switches, secondary buttons. */
  outline: string;
  ink: string;
  muted: string;
  placeholder: string;
  /** Charcoal (light) / sand (dark): filled main actions. */
  primary: string;
  onPrimary: string;
  /** Electric blue: interactive and selected states. */
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  success: string;
  onSuccess: string;
  warning: string;
  /** Soft tints for status cards and badges. */
  primarySoft: string;
  accentSoft: string;
  dangerSoft: string;
  successSoft: string;
  warningSoft: string;
};

export const PALETTE: Record<Scheme, Palette> = {
  light: {
    canvas: '#E9E0CE',
    highlight: 'rgba(255, 251, 242, 0.9)',
    shadow: 'rgba(120, 104, 78, 0.42)',
    hairline: 'rgba(90, 80, 62, 0.22)',
    outline: '#857D6E',
    ink: '#232528',
    muted: '#55524B',
    placeholder: '#7D786E',
    primary: '#2A2C30',
    onPrimary: '#F4EDE0',
    accent: '#0047E0',
    onAccent: '#FFFFFF',
    danger: '#A61E2D',
    onDanger: '#FFFFFF',
    success: '#1B6A44',
    onSuccess: '#FFFFFF',
    warning: '#874C00',
    primarySoft: '#DCD3C2',
    accentSoft: '#D6E0F7',
    dangerSoft: '#F1D6D0',
    successSoft: '#D6E5D2',
    warningSoft: '#F0DDB8',
  },
  dark: {
    canvas: '#1C1E21',
    highlight: 'rgba(238, 229, 211, 0.06)',
    shadow: 'rgba(0, 0, 0, 0.62)',
    hairline: 'rgba(238, 229, 211, 0.1)',
    outline: '#6E6A63',
    ink: '#EEE5D3',
    muted: '#B8B1A4',
    placeholder: '#8B867C',
    primary: '#E6D9C0',
    onPrimary: '#1C1E21',
    accent: '#4C9DFF',
    onAccent: '#06101F',
    danger: '#FF8E8E',
    onDanger: '#2A0B0E',
    success: '#74D29C',
    onSuccess: '#0C1F15',
    warning: '#F2BA60',
    primarySoft: '#2D2D2B',
    accentSoft: '#1B2A44',
    dangerSoft: '#3B2124',
    successSoft: '#1D3529',
    warningSoft: '#3A2F1C',
  },
};

const androidVersion = Platform.OS === 'android' ? Number(Platform.Version) : Infinity;
/** RN boxShadow: outset shadows need Android 9 (API 28), inset shadows Android 10 (API 29). */
export const SUPPORTS_OUTSET = androidVersion >= 28;
export const SUPPORTS_INSET = androidVersion >= 29;

export type Depth = 'flat' | 'low' | 'raised' | 'high';

const DEPTH: Record<Exclude<Depth, 'flat'>, { offset: number; blur: number }> = {
  low: { offset: 3, blur: 6 },
  raised: { offset: 6, blur: 14 },
  high: { offset: 9, blur: 20 },
};

/** Two-shadow lift for a raised surface. */
export function raisedShadow(p: Palette, depth: Depth = 'raised'): BoxShadowValue[] {
  if (depth === 'flat') return [];
  const { offset, blur } = DEPTH[depth];
  return [
    { offsetX: -offset, offsetY: -offset, blurRadius: blur, color: p.highlight },
    { offsetX: offset, offsetY: offset, blurRadius: blur, color: p.shadow },
  ];
}

/** Pressed-in look for wells, inputs, tracks and pressed buttons. */
export function insetShadow(p: Palette, depth: Exclude<Depth, 'flat'> = 'low'): BoxShadowValue[] {
  const { offset, blur } = DEPTH[depth];
  return [
    { offsetX: offset, offsetY: offset, blurRadius: blur, color: p.shadow, inset: true },
    { offsetX: -offset, offsetY: -offset, blurRadius: blur, color: p.highlight, inset: true },
  ];
}

/** A soft accent glow under a filled (primary) button. */
export function glowShadow(color: ColorValue): BoxShadowValue[] {
  return [{ offsetX: 0, offsetY: 6, blurRadius: 14, color: withAlpha(String(color), 0.35) }];
}

function withAlpha(hex: string, alpha: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const RADIUS = { sm: 12, md: 18, lg: 24, pill: 999 } as const;
