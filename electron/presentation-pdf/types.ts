import type { GoogleGenerativeAI } from '@google/generative-ai';

export interface SlideData {
  type: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftColumn?: { heading: string; items: string[] };
  rightColumn?: { heading: string; items: string[] };
  quote?: { text: string; author: string };
  imagePrompt?: string;
  notes?: string;
}

export interface ThemeConfig {
  colors?: Partial<ResolvedColors>;
  fontHeading?: string;
  fontBody?: string;
}

export interface ResolvedColors {
  bg: string;
  bgAlt: string;
  accent: string;
  accentAlt: string;
  text: string;
  textMuted: string;
  heading: string;
}

export interface ResolvedTheme {
  colors: ResolvedColors;
  fontHeading: string;
  fontBody: string;
}

export interface CreatePresentationPDFOptions {
  slides: SlideData[];
  title: string;
  outputPath: string;
  customTheme?: ThemeConfig;
  includeImages?: boolean;
  genAI?: GoogleGenerativeAI;
}
