import { clipboard } from 'electron';

type ClipboardToolResult = Record<string, unknown>;

export async function handleClipboardRead(): Promise<ClipboardToolResult> {
  try {
    return { success: true, content: await clipboard.readText() };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function handleClipboardWrite(args: Record<string, unknown>): Promise<ClipboardToolResult> {
  try {
    if (typeof args.text !== 'string') return { success: false, error: 'Se requiere texto válido para el portapapeles.' };
    await clipboard.writeText(args.text);
    return { success: true, message: 'Texto copiado al portapapeles.' };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
