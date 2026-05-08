import type { ClipboardAIAssistant } from '../clipboard-ai-assistant';

export const searchClipboardToolDeclaration = {
  name: 'search_clipboard_history',
  description: 'Busca inteligentemente en el historial reciente de textos copiados al portapapeles de la computadora.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      query: { type: 'STRING' as const, description: 'Descripcion en lenguaje natural de lo que se busca.' },
    },
    required: ['query'],
  },
};

export async function handleSearchClipboardTool(
  assistant: ClipboardAIAssistant,
  args: Record<string, any>,
): Promise<{ success: true; data: string }> {
  if (!args.query) {
    throw new Error('Debes proporcionar el parametro query.');
  }
  const result = await assistant.searchClipboardHistory(args.query);
  return { success: true, data: result };
}
