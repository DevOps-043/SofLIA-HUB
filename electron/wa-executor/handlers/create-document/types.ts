import type { ToolExecutorContext } from '../../types';

export const TOOL_NAME = 'create_document';

export interface DocumentBaseArgs {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
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
