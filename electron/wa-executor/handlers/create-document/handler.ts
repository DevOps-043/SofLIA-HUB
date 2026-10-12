import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../../types';
import { createMarkdownDocument, createWordDocument } from './basic-documents';
import { createExcelDocument } from './excel-document';
import { createPdfDocument } from './pdf-document';
import { createPresentationDocument } from './presentation-document';
import { resolveSaveDirectory } from './save-directory';
import { TOOL_NAME } from './types';
import { prepareOrganizationDocument } from '../../../organization-branding/document-branding';
import { documentDesignSchema } from '../../../../src/shared/document-design';

export async function handleCreateDocument(
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse> {
  try {
    const docType = toolArgs.type?.toLowerCase();
    const filename = toolArgs.filename || 'documento';
    const title = toolArgs.title || filename;
    const saveDir = await resolveSaveDirectory(toolArgs.save_directory || '');
    const baseArgs = { content: toolArgs.content, title, saveDir, filename, subtitle: toolArgs.subtitle, author: toolArgs.author,
      includeCover: typeof toolArgs.include_cover === 'boolean' ? toolArgs.include_cover : undefined, design: toolArgs.design };

    if (['word', 'docx', 'pdf'].includes(docType)) {
      const design = documentDesignSchema.parse(toolArgs.design ?? {});
      const identity = await prepareOrganizationDocument({ disabled: design.useOrganizationBranding === false });
      const prepared = { ...baseArgs, design, brand: identity.brand, beforeSave: identity.assertCurrent };
      return success(await (docType === 'pdf' ? createPdfDocument(prepared) : createWordDocument(prepared)), docType === 'pdf' ? 'Documento PDF creado' : 'Documento Word profesional creado', identity.notice);
    }
    if (docType === 'excel' || docType === 'xlsx') return success(await createExcelDocument(baseArgs), 'Documento Excel creado');
    if (docType === 'md' || docType === 'markdown') return success(await createMarkdownDocument(baseArgs), 'Documento Markdown creado');

    if (docType === 'pptx' || docType === 'powerpoint' || docType === 'presentacion' || docType === 'presentacion_pdf') {
      const { filePath, slideCount } = await createPresentationDocument({
        ...baseArgs,
        format: docType === 'presentacion_pdf' ? 'pdf' : 'pptx',
        slidesJson: toolArgs.slides_json,
        customTheme: toolArgs.custom_theme,
        includeImages: toolArgs.include_images !== false,
        ctx,
      });
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Presentación creada: ${filePath} (${slideCount} diapositivas)`,
      });
    }

    return errorResponse(TOOL_NAME, 'Tipo no valido. Usa "word", "excel", "pdf", "pptx" o "md".');
  } catch (err: any) {
    return errorResponse(TOOL_NAME, err.message);
  }
}

function success(filePath: string, label: string, notice?: string | null): FunctionResponse {
  return buildResponse(TOOL_NAME, {
    success: true,
    file_path: filePath,
    ...(notice ? { design_notice: notice } : {}),
    message: `${label}: ${filePath}`,
  });
}
