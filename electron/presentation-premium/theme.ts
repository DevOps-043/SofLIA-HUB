import type { ResolvedTheme, ThemeConfig } from './types';

const THEMES: Record<string, ResolvedTheme> = {
  'corporate-dark': {
    colors: {
      bg: '0F1117', bgAlt: '1A1D2B', accent: '22D3EE', accentAlt: '6366F1',
      text: 'EAEAEA', textMuted: '9CA3AF', heading: 'FFFFFF',
      scrim: '000000', scrimOpacity: 55,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'modern-light': {
    colors: {
      bg: 'FFFFFF', bgAlt: 'F3F4F6', accent: '4F46E5', accentAlt: '7C3AED',
      text: '374151', textMuted: '6B7280', heading: '111827',
      scrim: '000000', scrimOpacity: 45,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'gradient-vibrant': {
    colors: {
      bg: '0F0720', bgAlt: '1E1145', accent: 'F472B6', accentAlt: 'A78BFA',
      text: 'E2E8F0', textMuted: 'A5B4C8', heading: 'FFFFFF',
      scrim: '0F0720', scrimOpacity: 60,
    },
    fontHeading: 'Segoe UI', fontBody: 'Segoe UI',
  },
  'minimal-elegant': {
    colors: {
      bg: 'FAF9F6', bgAlt: 'F0EDEA', accent: 'B8860B', accentAlt: '8B7355',
      text: '3C3C3C', textMuted: '8A8A8A', heading: '1A1A1A',
      scrim: '1A1A1A', scrimOpacity: 50,
    },
    fontHeading: 'Georgia', fontBody: 'Segoe UI',
  },
  'tech-neon': {
    colors: {
      bg: '0A0A0A', bgAlt: '141414', accent: '00FF87', accentAlt: '00D4FF',
      text: 'D4D4D4', textMuted: '737373', heading: 'FFFFFF',
      scrim: '000000', scrimOpacity: 60,
    },
    fontHeading: 'Consolas', fontBody: 'Segoe UI',
  },
};

const DEFAULT_THEME = THEMES['corporate-dark'];

export function resolveTheme(themeName?: string, custom?: ThemeConfig): ResolvedTheme {
  const base = THEMES[themeName || ''] || DEFAULT_THEME;
  return {
    colors: { ...base.colors, ...(custom?.colors || {}) },
    fontHeading: custom?.fontHeading || base.fontHeading,
    fontBody: custom?.fontBody || base.fontBody,
  };
}
