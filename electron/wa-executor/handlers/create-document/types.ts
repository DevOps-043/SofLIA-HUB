import type { ToolExecutorContext } from '../../types';
import type { DocumentDesignOptions } from '../../../../src/shared/document-design';

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
}

export interface PresentationDocumentArgs extends DocumentBaseArgs {
  slidesJson?: string;
  customTheme?: string;
  includeImages: boolean;
  ctx: ToolExecutorContext;
}

export interface PresentationDocumentResult {
  filePath: string;
  slideCount: number;
}
