import type { ResolvedColors, ResolvedTheme, ThemeConfig } from './types';

const DEFAULTS: ResolvedColors = {
  bg: '0F1117',
  bgAlt: '1A1D2B',
  accent: '22D3EE',
  accentAlt: '6366F1',
  text: 'EAEAEA',
  textMuted: '9CA3AF',
  heading: 'FFFFFF',
};

export function mergeTheme(custom?: ThemeConfig): ResolvedTheme {
  const colors = custom?.colors || {};
  return {
    colors: {
      bg: colors.bg || DEFAULTS.bg,
      bgAlt: colors.bgAlt || DEFAULTS.bgAlt,
      accent: colors.accent || DEFAULTS.accent,
      accentAlt: colors.accentAlt || DEFAULTS.accentAlt,
      text: colors.text || DEFAULTS.text,
      textMuted: colors.textMuted || DEFAULTS.textMuted,
      heading: colors.heading || DEFAULTS.heading,
    },
    fontHeading: custom?.fontHeading || 'Segoe UI',
    fontBody: custom?.fontBody || 'Segoe UI',
  };
}
