export interface DocumentOptions {
  content: string;
  title: string;
  subtitle?: string;
  author?: string;
  outputPath: string;
  type: 'word' | 'pdf';
  includeCover?: boolean;
  includeTOC?: boolean;
}

export interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}
