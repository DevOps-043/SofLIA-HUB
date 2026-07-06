import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { PowerShellExecutor } from './window-controls';
import type { InputDriver } from './input-driver/types';
import { LEFTDOWN, LEFTUP, PINVOKE_HEADER, RIGHTDOWN, RIGHTUP, WHEEL } from '../desktop-agent-types';
import { assertGuiAutomationSupported, detectPlatformCapabilities } from '../platform-capabilities';

type ScalePoint = (x: number, y: number) => { x: number; y: number };
type Delay = (ms: number) => Promise<void>;
const execFileAsync = promisify(execFileCb);

export class DesktopMouseControls {
  /**
   * Driver de entrada de alto nivel (nut.js, movimiento humano). Si está
   * seteado, TODA síntesis física del mouse pasa por él. Si es null, se usa la
   * implementación raw (PowerShell/xdotool) — sin recursión, porque el driver
   * legacy invoca los métodos públicos con el driver ya en null.
   */
  private inputDriver: InputDriver | null = null;

  constructor(
    private readonly ps: PowerShellExecutor,
    private readonly scale: ScalePoint,
    private readonly delay: Delay,
  ) {}

  setInputDriver(driver: InputDriver | null): void {
    this.inputDriver = driver;
  }

  async mouseClick(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    await this.clickAtPhysicalPoint(point.x, point.y);
  }

  /**
   * Click directo en PIXELES FISICOS de pantalla, sin pasar por la conversion
   * imagen->fisico. Es la via de los clicks medidos por el element-locator
   * (accesibilidad/OCR), cuyas coordenadas ya son fisicas.
   */
  async clickAtPhysicalPoint(physicalX: number, physicalY: number): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.click({ x: physicalX, y: physicalY });
      return;
    }
    await this.clickPhysicalRaw(physicalX, physicalY);
  }

  private async clickPhysicalRaw(physicalX: number, physicalY: number): Promise<void> {
    const x = Math.round(physicalX);
    const y = Math.round(physicalY);
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(x), String(y), 'click', '1']);
      return;
    }
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async doubleClickAtPhysicalPoint(physicalX: number, physicalY: number): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.doubleClick({ x: physicalX, y: physicalY });
      return;
    }
    await this.clickPhysicalRaw(physicalX, physicalY);
    await this.delay(80);
    await this.clickPhysicalRaw(physicalX, physicalY);
  }

  async rightClickAtPhysicalPoint(physicalX: number, physicalY: number): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.click({ x: physicalX, y: physicalY }, 'right');
      return;
    }
    const x = Math.round(physicalX);
    const y = Math.round(physicalY);
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(x), String(y), 'click', '3']);
      return;
    }
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 60
[W.U]::mouse_event(${RIGHTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${RIGHTUP},0,0,0,0)`);
  }

  async mouseMoveToPhysicalPoint(physicalX: number, physicalY: number): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.moveTo({ x: physicalX, y: physicalY });
      return;
    }
    const x = Math.round(physicalX);
    const y = Math.round(physicalY);
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(x), String(y)]);
      return;
    }
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${x}, ${y})`);
  }

  async dragBetweenPhysicalPoints(x1: number, y1: number, x2: number, y2: number, durationMs = 500): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.dragTo({ x: x1, y: y1 }, { x: x2, y: y2 });
      return;
    }
    const start = { x: Math.round(x1), y: Math.round(y1) };
    const end = { x: Math.round(x2), y: Math.round(y2) };
    if (process.platform !== 'win32') {
      const steps = Math.max(10, Math.floor(durationMs / 16));
      const stepDelay = Math.round(durationMs / steps);
      await runXdotool(['mousemove', String(start.x), String(start.y), 'mousedown', '1']);
      for (let index = 0; index < steps; index++) {
        const t = (index + 1) / steps;
        await runXdotool(['mousemove', String(Math.round(start.x + (end.x - start.x) * t)), String(Math.round(start.y + (end.y - start.y) * t))]);
        await this.delay(stepDelay);
      }
      await runXdotool(['mouseup', '1']);
      return;
    }
    const steps = Math.max(10, Math.floor(durationMs / 16));
    const stepDelay = Math.round(durationMs / steps);
    const movements = Array.from({ length: steps }, (_, index) => {
      const t = (index + 1) / steps;
      return `[W.U]::SetCursorPos(${Math.round(start.x + (end.x - start.x) * t)}, ${Math.round(start.y + (end.y - start.y) * t)}); Start-Sleep -Milliseconds ${stepDelay}`;
    }).join('; ');
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${start.x}, ${start.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${LEFTDOWN},0,0,0,0)
Start-Sleep -Milliseconds 50
${movements}
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseDoubleClick(x: number, y: number): Promise<void> {
    await this.mouseClick(x, y);
    await this.delay(80);
    await this.mouseClick(x, y);
  }

  async mouseRightClick(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(point.x), String(point.y), 'click', '3']);
      return;
    }
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
    if (process.platform !== 'win32') {
      const steps = Math.max(10, Math.floor(durationMs / 16));
      const stepDelay = Math.round(durationMs / steps);
      await runXdotool(['mousemove', String(start.x), String(start.y), 'mousedown', '1']);
      for (let index = 0; index < steps; index++) {
        const t = (index + 1) / steps;
        const cx = Math.round(start.x + (end.x - start.x) * t);
        const cy = Math.round(start.y + (end.y - start.y) * t);
        await runXdotool(['mousemove', String(cx), String(cy)]);
        await this.delay(stepDelay);
      }
      await runXdotool(['mouseup', '1']);
      return;
    }
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
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(point.x), String(point.y), 'mousedown', button === 'left' ? '1' : '3']);
      return;
    }
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 50
[W.U]::mouse_event(${flag},0,0,0,0)`);
  }

  async mouseUp(x?: number, y?: number): Promise<void> {
    if (x !== undefined && y !== undefined) {
      const point = this.scale(x, y);
      if (process.platform !== 'win32') {
        await runXdotool(['mousemove', String(point.x), String(point.y), 'mouseup', '1']);
        return;
      }
      await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
      return;
    }

    if (process.platform !== 'win32') {
      await runXdotool(['mouseup', '1']);
      return;
    }
    await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${LEFTUP},0,0,0,0)`);
  }

  async mouseMove(x: number, y: number): Promise<void> {
    const point = this.scale(x, y);
    if (process.platform !== 'win32') {
      await runXdotool(['mousemove', String(point.x), String(point.y)]);
      return;
    }
    await this.ps(`${PINVOKE_HEADER}
[W.U]::SetCursorPos(${point.x}, ${point.y})`);
  }

  async mouseScroll(direction: 'up' | 'down', amount = 3): Promise<void> {
    // El modelo (o la recuperacion) puede pasar amount NaN/0/negativo. El default
    // de parametro solo cubre `undefined`, NO NaN -> generaria mouse_event(...,NaN,...)
    // y PowerShell peta ("Falta una expresion despues de ,"). Se sanea a entero valido.
    const pasos = Number.isFinite(amount) && amount > 0 ? Math.min(Math.floor(amount), 20) : 3;
    if (process.platform !== 'win32') {
      const button = direction === 'up' ? '4' : '5';
      for (let index = 0; index < pasos; index++) await runXdotool(['click', button]);
      return;
    }
    const delta = direction === 'up' ? 120 * pasos : -120 * pasos;
    await this.ps(`Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::mouse_event(${WHEEL},0,0,${delta},0)`);
  }
}

async function runXdotool(args: string[]): Promise<void> {
  const capabilities = detectPlatformCapabilities();
  assertGuiAutomationSupported(capabilities);
  if (!capabilities.linuxXdotool) throw new Error(capabilities.unsupportedReason || 'xdotool solo se usa en Linux X11.');
  try {
    await execFileAsync('xdotool', args, { timeout: 10000, windowsHide: true });
  } catch (err: any) {
    throw new Error(`No se pudo ejecutar xdotool. Instala xdotool y usa una sesion X11. Detalle: ${err.message}`);
  }
}
