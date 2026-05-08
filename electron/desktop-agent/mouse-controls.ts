import type { PowerShellExecutor } from './window-controls';
import { LEFTDOWN, LEFTUP, PINVOKE_HEADER, RIGHTDOWN, RIGHTUP, WHEEL } from '../desktop-agent-types';

type ScalePoint = (x: number, y: number) => { x: number; y: number };
type Delay = (ms: number) => Promise<void>;

export class DesktopMouseControls {
  constructor(
    private readonly ps: PowerShellExecutor,
    private readonly scale: ScalePoint,
    private readonly delay: Delay,
  ) {}

  async mouseClick(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseDoubleClick(x: number, y: number): Promise<void> {
    await this.mouseClick(x, y);
    await this.delay(80);
    await this.mouseClick(x, y);
  }

  async mouseRightClick(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${RIGHTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${RIGHTUP},0,0,0,0)`);
  }

  async mouseDrag(x1: number, y1: number, x2: number, y2: number, durationMs = 500): Promise<void> {
    const start = this.scale(x1, y1);
    const end = this.scale(x2, y2);
    const steps = Math.max(10, Math.floor(durationMs / 16));
    const stepDelay = Math.round(durationMs / steps);
    const movements = Array.from({ length: steps }, (_, index) => {
      const t = (index + 1) / steps;
      const cx = Math.round(start.x + (end.x - start.x) * t);
      const cy = Math.round(start.y + (end.y - start.y) * t);
      return `[W.U]::SetCursorPos(${cx}, ${cy}); Start-Sleep -Milliseconds ${stepDelay}`;
    }).join('; ');

    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${start.x}, ${start.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 50
${movements}
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseDown(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
    const point = this.scale(x, y);
    const flag = button === 'left' ? LEFTDOWN : RIGHTDOWN;
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${flag},0,0,0,0)`);
  }

  async mouseUp(x?: number, y?: number): Promise<void> {
    if (x !== undefined && y !== undefined) {
      const point = this.scale(x, y);
      await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
      return;
    }

    await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseMove(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})`);
  }

  async mouseScroll(direction: 'up' | 'down', amount = 3): Promise<void> {
    const delta = direction === 'up' ? 120 * amount : -120 * amount;
    await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${WHEEL},0,0,${delta},0)`);
  }
}
