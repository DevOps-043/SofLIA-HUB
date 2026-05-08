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
  diagramPrompt?: string;
  notes?: string;
  items?: Array<{ icon?: string; label: string; description?: string; color?: string }>;
  steps?: Array<{ label: string; description?: string }>;
  tableData?: { headers: string[]; rows: string[][] };
  stats?: Array<{ value: string; label: string; trend?: string }>;
}

export interface ThemeConfig {
  colors?: Partial<ThemeColors>;
  fontHeading?: string;
  fontBody?: string;
}

export interface ThemeColors {
  bg: string;
  bgAlt: string;
  accent: string;
  accentAlt: string;
  text: string;
  textMuted: string;
  heading: string;
  scrim: string;
  scrimOpacity: number;
}

export interface ResolvedTheme {
  colors: ThemeColors;
  fontHeading: string;
  fontBody: string;
}

export interface CreatePresentationPDFOptions {
  slides: SlideData[];
  title: string;
  outputPath: string;
  themeName?: string;
  customTheme?: ThemeConfig;
  includeImages?: boolean;
  genAI?: GoogleGenerativeAI;
}
