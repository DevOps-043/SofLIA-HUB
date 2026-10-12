import type { ToolExecutorContext } from '../../types';
import type { DocumentDesignOptions } from '../../../../src/shared/document-design';
import type { DocumentBranding } from '../../../../src/shared/document-branding';

export const TOOL_NAME = 'create_document';

export interface DocumentBaseArgs {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
  subtitle?: string;
  author?: string;
  includeCover?: boolean;
  design?: DocumentDesignOptions;
  brand?: DocumentBranding;
  beforeSave?: () => Promise<void>;
}

export interface PresentationDocumentArgs extends DocumentBaseArgs {
  format?: 'pptx' | 'pdf';
  slidesJson?: string;
  customTheme?: string;
  includeImages: boolean;
  ctx: ToolExecutorContext;
}

export interface PresentationDocumentResult {
  filePath: string;
  slideCount: number;
}
