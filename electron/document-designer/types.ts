import type { DocumentDesignOptions } from '../../src/shared/document-design';
import type { DocumentBranding } from '../../src/shared/document-branding';

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
  /** Contexto interno verificado; no se expone como argumento de herramienta. */
  brand?: DocumentBranding;
  beforeSave?: () => Promise<void>;
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
