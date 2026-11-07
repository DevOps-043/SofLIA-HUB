import { performGuiAction } from './gui-action';
import { findTextCoordinates } from './ocr-targeting';
import { handleTakeScreenshot } from './screenshot-tool';
import { captureGuiLease, GuiFailure, type ComputerExecutionGuard } from './gui/execution-context';
import { parseGuiInput } from './gui/input';
import { createLogger } from '../utils/logger';
const log = createLogger('computer-gui');
let active = false;

export async function handleUseComputer(args: Record<string, unknown>, onProgress?: (message: string) => void, context?: ComputerExecutionGuard): Promise<Record<string, unknown>> {
  const lease = captureGuiLease(context); let admitted = false, mayHaveApplied = false;
  try {
    lease.assertCurrent();
    const progress = (message: string) => { lease.assertCurrent(); onProgress?.(message); };
    if (active) throw new GuiFailure('GUI_BUSY');
    active = true; admitted = true;
    const input = parseGuiInput(args), action = input.action ?? 'screenshot';
    lease.assertCurrent();
    if (action === 'screenshot') {
      const result = await handleTakeScreenshot({ display_id: input.display_id }, progress);
      lease.assertCurrent();
      if (result.success !== true || typeof result.image !== 'string') throw new GuiFailure('GUI_FAILED');
      return result;
    }
    progress('Preparando entrada de escritorio.');
    let coordinate = input.coordinate;
    if (!coordinate && input.text && !['type', 'key'].includes(action)) {
      const capture = await handleTakeScreenshot({ display_id: input.display_id }, progress);
      lease.assertCurrent();
      if (!capture.success || typeof capture.image !== 'string' || !capture.image.startsWith('data:image/png;base64,') || capture.image.length > 44 * 1024 * 1024) throw new GuiFailure('GUI_FAILED');
      const position = await findTextCoordinates(input.text, Buffer.from(capture.image.slice('data:image/png;base64,'.length), 'base64'), lease);
      lease.assertCurrent(); coordinate = [position.x, position.y];
    }
    lease.assertCurrent(); mayHaveApplied = true;
    await performGuiAction(action, coordinate, input.text, lease);
    lease.assertCurrent();
    const result = await handleTakeScreenshot({ display_id: input.display_id }, progress);
    lease.assertCurrent();
    if (result.success !== true || typeof result.image !== 'string') throw new GuiFailure('GUI_FAILED');
    return result;
  } catch (error) {
    const code = error instanceof GuiFailure ? error.code : 'GUI_FAILED';
    log.warn({ code, mayHaveApplied }, 'Operación GUI incompleta.');
    return { success: false, code, error: 'No se completó la operación de escritorio.', mayHaveApplied };
  } finally { if (admitted) active = false; lease.dispose(); }
}
