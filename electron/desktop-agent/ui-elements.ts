import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { UIElement } from '../desktop-agent-types';
import { GET_FOREGROUND_UI_ELEMENTS_SCRIPT } from './ui-elements-script';

const execAsync = promisify(execCb);

type RawUIElement = {
  id?: number;
  name?: string;
  controlType?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isEnabled?: boolean;
  automationId?: string;
  value?: string;
};
export async function getForegroundUIElements(): Promise<UIElement[]> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${GET_FOREGROUND_UI_ELEMENTS_SCRIPT}"`,
      { timeout: 4000, windowsHide: true },
    );
    const parsed = JSON.parse(stdout || '[]') as RawUIElement | RawUIElement[];
    return (Array.isArray(parsed) ? parsed : [parsed])
      .filter((element): element is RawUIElement & { id: number } => Boolean(element && element.id))
      .map((element) => ({
        id: element.id,
        name: element.name || '',
        controlType: element.controlType || 'Unknown',
        boundingRect: { x: element.x || 0, y: element.y || 0, width: element.width || 0, height: element.height || 0 },
        isEnabled: element.isEnabled !== false,
        automationId: element.automationId || '',
        value: element.value || '',
      }))
      .sort((a, b) => {
        const deltaY = a.boundingRect.y - b.boundingRect.y;
        if (Math.abs(deltaY) > 12) {
        return deltaY;
      }
        return a.boundingRect.x - b.boundingRect.x;
      });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[DesktopAgent] UI Automation fallo:', message);
    return [];
  }
}
