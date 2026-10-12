import type { DocumentDesignOptions } from '../../src/shared/document-design';

export interface DocumentOptions {
  content: string;
  title: string;
  subtitle?: string;
  author?: string;
  outputPath: string;
  type: 'word' | 'pdf';
  includeCover?: boolean;
  /** Preferencias de usuario o skill, validadas antes de generar. */
  design?: DocumentDesignOptions;
  includeTOC?: boolean;
  /** Graficas como data URLs (data:image/png;base64,...) que se anexan al final. */
  chartImages?: string[];
}

export interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}
