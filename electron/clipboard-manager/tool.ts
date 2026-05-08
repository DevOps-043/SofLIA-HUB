import { z } from 'zod';
import type { ClipboardToolActions } from './types';

export const ClipboardToolSchema = z.object({
  action: z.enum(['read', 'write', 'history']),
  content: z.string().optional(),
});

export type ClipboardToolInput = z.infer<typeof ClipboardToolSchema>;

export const clipboardManagerTool = {
  name: 'clipboard_manager',
  description: 'Permite leer, escribir y ver el historial del portapapeles de la PC.',
  parameters: ClipboardToolSchema,
};

export async function executeClipboardTool(
  actions: ClipboardToolActions,
  args: ClipboardToolInput,
): Promise<any> {
  try {
    if (args.action === 'read') {
      return { success: true, data: { text: actions.readText() || '(Portapapeles vacio)' } };
    }
    if (args.action === 'write') {
      if (!args.content) return { success: false, error: 'Se requiere el campo "content" para la accion "write".' };
      actions.writeText(args.content);
      return { success: true, message: 'Texto copiado exitosamente al portapapeles del sistema.' };
    }
    if (args.action === 'history') {
      const history = actions.getHistory();
      return { success: true, data: { total: history.length, items: history.length > 0 ? history : ['(Historial vacio)'] } };
    }
    return { success: false, error: `Accion no soportada: ${args.action}` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
