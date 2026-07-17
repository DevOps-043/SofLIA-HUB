export interface DocumentOptions {
  content: string;
  title: string;
  subtitle?: string;
  author?: string;
  outputPath: string;
  type: 'word' | 'pdf';
  includeCover?: boolean;
  includeTOC?: boolean;
  /** Graficas como data URLs (data:image/png;base64,...) que se anexan al final. */
  chartImages?: string[];
}

export interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}
