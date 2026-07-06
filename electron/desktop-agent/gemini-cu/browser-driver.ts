import type { CuAction, CuCapture, CuDriver } from './types';

/**
 * Driver de Computer Use para navegador sobre una `page` de Playwright. Las
 * coordenadas de `CuAction` vienen en PIXELES del viewport (ya denormalizadas),
 * que es justo lo que espera `page.mouse`.
 */

// Superficie minima de la Page de Playwright que usamos (evita acoplar tipos).
type PwMouse = {
  click: (x: number, y: number, opts?: { button?: 'left' | 'right'; clickCount?: number }) => Promise<void>;
  move: (x: number, y: number) => Promise<void>;
  down: (opts?: { button?: 'left' | 'right' }) => Promise<void>;
  up: (opts?: { button?: 'left' | 'right' }) => Promise<void>;
  wheel: (deltaX: number, deltaY: number) => Promise<void>;
};
type PwKeyboard = {
  type: (text: string) => Promise<void>;
  press: (key: string) => Promise<void>;
};
export type PlaywrightPage = {
  screenshot: (opts?: { type?: 'png' }) => Promise<Buffer>;
  viewportSize: () => { width: number; height: number } | null;
  mouse: PwMouse;
  keyboard: PwKeyboard;
  url: () => string;
  goto: (url: string) => Promise<unknown>;
  goBack: () => Promise<unknown>;
  goForward: () => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
};

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export function createBrowserCuDriver(page: PlaywrightPage): CuDriver {
  return {
    entorno: 'ENVIRONMENT_BROWSER',
    async capturar(): Promise<CuCapture> {
      const buffer = await page.screenshot({ type: 'png' });
      const vp = page.viewportSize() ?? DEFAULT_VIEWPORT;
      return { base64: buffer.toString('base64'), width: vp.width, height: vp.height };
    },
    contexto: () => ({ url: page.url() }),
    async ejecutar(action: CuAction): Promise<void> {
      switch (action.tipo) {
        case 'click':
          await page.mouse.click(action.punto.x, action.punto.y);
          return;
        case 'double_click':
          await page.mouse.click(action.punto.x, action.punto.y, { clickCount: 2 });
          return;
        case 'right_click':
          await page.mouse.click(action.punto.x, action.punto.y, { button: 'right' });
          return;
        case 'middle_click':
          await page.mouse.click(action.punto.x, action.punto.y);
          return;
        case 'move':
          await page.mouse.move(action.punto.x, action.punto.y);
          return;
        case 'mouse_down':
          await page.mouse.move(action.punto.x, action.punto.y);
          await page.mouse.down();
          return;
        case 'mouse_up':
          await page.mouse.move(action.punto.x, action.punto.y);
          await page.mouse.up();
          return;
        case 'type':
          await page.keyboard.type(action.texto);
          if (action.enter) await page.keyboard.press('Enter');
          return;
        case 'key':
          await page.keyboard.press(traducirTeclasPlaywright(action.teclas));
          return;
        case 'scroll': {
          const paso = 100 * action.magnitud;
          const dx = action.direccion === 'right' ? paso : action.direccion === 'left' ? -paso : 0;
          const dy = action.direccion === 'down' ? paso : action.direccion === 'up' ? -paso : 0;
          await page.mouse.wheel(dx, dy);
          return;
        }
        case 'drag':
          await page.mouse.move(action.desde.x, action.desde.y);
          await page.mouse.down();
          await page.mouse.move(action.hasta.x, action.hasta.y);
          await page.mouse.up();
          return;
        case 'wait':
          await page.waitForTimeout(action.ms);
          return;
        case 'navigate':
          if (action.url) await page.goto(action.url);
          return;
        case 'go_back':
          await page.goBack();
          return;
        case 'go_forward':
          await page.goForward();
          return;
        case 'screenshot':
        case 'desconocida':
          return;
      }
    },
  };
}

/** Traduce "ctrl+s" a la sintaxis de Playwright ("Control+S"). Exportada para test. */
export function traducirTeclasPlaywright(teclas: string): string {
  const mapa: Record<string, string> = {
    ctrl: 'Control', control: 'Control', alt: 'Alt', shift: 'Shift', meta: 'Meta', win: 'Meta', cmd: 'Meta',
    enter: 'Enter', return: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: 'Space',
    backspace: 'Backspace', delete: 'Delete', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  };
  return teclas
    .split('+')
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => mapa[k] ?? (k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1)))
    .join('+');
}
