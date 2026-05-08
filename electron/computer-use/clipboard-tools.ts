import { clipboard } from 'electron';

export function handleClipboardRead(): Record<string, any> {
  try {
    return { success: true, content: clipboard.readText() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function handleClipboardWrite(args: Record<string, any>): Record<string, any> {
  try {
    clipboard.writeText(args.text);
    return { success: true, message: 'Texto copiado al portapapeles.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
