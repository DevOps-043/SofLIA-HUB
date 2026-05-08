import { VisualDebuggerService } from '../visual-debugger-service';
import { performGuiAction } from './gui-action';
import { findTextCoordinates } from './ocr-targeting';
import { handleTakeScreenshot } from './screenshot-tool';

export async function handleUseComputer(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<Record<string, any>> {
  let lastKnownCoords = { x: 0, y: 0 };
  try {
    const action = args.action || 'screenshot';
    if (args.coordinate && Array.isArray(args.coordinate) && args.coordinate.length >= 2) {
      lastKnownCoords = { x: Math.round(args.coordinate[0]), y: Math.round(args.coordinate[1]) };
    }
    if (action === 'screenshot') return handleTakeScreenshot(args, onProgress);

    onProgress?.(`Ejecutando acciÃ³n GUI: ${action}...`);
    if (!args.coordinate && args.text && ['left_click', 'right_click', 'double_click', 'mouse_move', 'left_click_drag'].includes(action)) {
      const coords = await findCoordinatesFromText(args, onProgress);
      lastKnownCoords = { x: coords.x, y: coords.y };
      args.coordinate = [coords.x, coords.y];
    }
    await performGuiAction(action, args.coordinate, args.text);
    return handleTakeScreenshot({ display_id: args.display_id }, onProgress);
  } catch (err: any) {
    const { x, y } = lastKnownCoords;
    await VisualDebuggerService.handleVisualError(err.message, x, y);
    return { success: false, error: err.message };
  }
}

async function findCoordinatesFromText(args: Record<string, any>, onProgress?: (message: string) => void) {
  onProgress?.(`Buscando texto "${args.text}" en pantalla con OCR...`);
  const capture = await handleTakeScreenshot({ display_id: args.display_id });
  if (!capture.success) throw new Error(capture.error);
  const base64Data = capture.image.replace(/^data:image\/png;base64,/, '');
  const coords = await findTextCoordinates(args.text, Buffer.from(base64Data, 'base64'));
  onProgress?.(`Texto encontrado en coordenadas: [${coords.x}, ${coords.y}] (Confianza: ${Math.round(coords.confidence)}%)`);
  return coords;
}
