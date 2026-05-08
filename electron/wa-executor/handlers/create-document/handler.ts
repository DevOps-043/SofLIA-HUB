import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../../types';
import { createMarkdownDocument, createWordDocument } from './basic-documents';
import { createExcelDocument } from './excel-document';
import { createPdfDocument } from './pdf-document';
import { createPresentationDocument } from './presentation-document';
import { resolveSaveDirectory } from './save-directory';
import { TOOL_NAME } from './types';

export async function handleCreateDocument(
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse> {
  try {
    const docType = toolArgs.type?.toLowerCase();
    const filename = toolArgs.filename || 'documento';
    const title = toolArgs.title || filename;
    const saveDir = await resolveSaveDirectory(toolArgs.save_directory || '');
    const baseArgs = { content: toolArgs.content, title, saveDir, filename };

    if (docType === 'word' || docType === 'docx') return success(await createWordDocument(baseArgs), 'Documento Word profesional creado');
    if (docType === 'excel' || docType === 'xlsx') return success(await createExcelDocument(baseArgs), 'Documento Excel creado');
    if (docType === 'md' || docType === 'markdown') return success(await createMarkdownDocument(baseArgs), 'Documento Markdown creado');
    if (docType === 'pdf') return success(await createPdfDocument(baseArgs), 'Documento PDF creado');

    if (docType === 'pptx' || docType === 'powerpoint' || docType === 'presentacion') {
      const { filePath, slideCount } = await createPresentationDocument({
        ...baseArgs,
        slidesJson: toolArgs.slides_json,
        customTheme: toolArgs.custom_theme,
        includeImages: toolArgs.include_images !== false,
        ctx,
      });
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Presentacion PDF premium creada: ${filePath} (${slideCount} diapositivas con diseno profesional e imagenes AI)`,
      });
    }

    return errorResponse(TOOL_NAME, 'Tipo no valido. Usa "word", "excel", "pdf", "pptx" o "md".');
  } catch (err: any) {
    return errorResponse(TOOL_NAME, err.message);
  }
}

function success(filePath: string, label: string): FunctionResponse {
  return buildResponse(TOOL_NAME, {
    success: true,
    file_path: filePath,
    message: `${label}: ${filePath}`,
  });
}
