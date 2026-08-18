import type { InputEvent } from 'electron';
import type { CuDriver, CuPoint } from '../desktop-agent/gemini-cu/types';
import { applySoMOverlay } from '../desktop-agent/screenshot-overlays';
import { loadSharp, type SharpFactory } from '../desktop-agent/sharp';
import {
  MAX_BROWSER_MARKS,
  buildBrowserMarks,
  scaleRectToImage,
  type BrowserMark,
} from './dom-element-source';
import type { BrowserDomSnapshot } from './types';
import type { IntegratedBrowserService } from './service';

export function createIntegratedBrowserCuDriver(service: IntegratedBrowserService): CuDriver {
  let captureSize = service.getViewportSize();
  let latestContext: Record<string, unknown> = {};
  return {
    entorno: 'ENVIRONMENT_BROWSER',
    async capturar() {
      const viewportSize = service.getViewportSize();
      const observed = await service.getObservation(true);
      const observation = observed.observation;
      const encoded = readDataUrlPayload(observation?.screenshot);
      if (encoded) {
        // `captureSize` sigue siendo el viewport: es el espacio en el que se
        // denormalizan las coordenadas del modelo. Marcar la imagen no puede
        // tocarlo o cada clic saldria desplazado por el factor de reduccion.
        captureSize = viewportSize;
        const marcado = await markCapture(encoded, observation!.dom, viewportSize);
        latestContext = {
          observedAt: observation!.capturedAt,
          page: observation!.dom,
          trust: 'untrusted_page_content',
          ...(marcado.marks.length ? { marks: describeMarks(marcado.marks) } : {}),
        };
        return {
          base64: marcado.base64,
          width: captureSize.width,
          height: captureSize.height,
          context: latestContext,
        };
      }
      const contents = service.getWebContentsForAgent();
      const image = await contents.capturePage();
      const imageWithSize = image as typeof image & { getSize?: () => ViewportSize };
      captureSize = normalizeCaptureSize(imageWithSize.getSize?.(), viewportSize);
      latestContext = { url: service.getState().url, superficie: 'navegador_integrado' };
      return { base64: image.toPNG().toString('base64'), width: captureSize.width, height: captureSize.height, context: latestContext };
    },
    contexto: () => ({ ...latestContext, url: service.getState().url, superficie: 'navegador_integrado' }),
    async ejecutar(action) {
      const contents = service.getWebContentsForAgent();
      const size = service.getViewportSize();
      switch (action.tipo) {
        case 'click':
          sendClick(contents, toViewportPoint(action.punto, captureSize, size), 'left', 1);
          return;
        case 'double_click':
          sendClick(contents, toViewportPoint(action.punto, captureSize, size), 'left', 2);
          return;
        case 'right_click':
          sendClick(contents, toViewportPoint(action.punto, captureSize, size), 'right', 1);
          return;
        case 'middle_click':
          sendClick(contents, toViewportPoint(action.punto, captureSize, size), 'middle', 1);
          return;
        case 'move': {
          const point = toViewportPoint(action.punto, captureSize, size);
          contents.sendInputEvent({ type: 'mouseMove', ...point });
          return;
        }
        case 'mouse_down': {
          const point = toViewportPoint(action.punto, captureSize, size);
          contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
          return;
        }
        case 'mouse_up': {
          const point = toViewportPoint(action.punto, captureSize, size);
          contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
          return;
        }
        case 'type':
          await contents.insertText(action.texto.slice(0, 20_000));
          if (action.enter) sendKey(contents, 'enter');
          return;
        case 'key':
          sendKey(contents, action.teclas);
          return;
        case 'scroll': {
          const point = action.punto
            ? toViewportPoint(action.punto, captureSize, size)
            : { x: Math.round(size.width / 2), y: Math.round(size.height / 2) };
          const delta = Math.min(Math.max(action.magnitud, 1), 20) * 100;
          contents.sendInputEvent({
            type: 'mouseWheel',
            ...point,
            deltaX: action.direccion === 'right' ? delta : action.direccion === 'left' ? -delta : 0,
            deltaY: action.direccion === 'down' ? -delta : action.direccion === 'up' ? delta : 0,
            canScroll: true,
          });
          return;
        }
        case 'drag':
          sendDrag(
            contents,
            toViewportPoint(action.desde, captureSize, size),
            toViewportPoint(action.hasta, captureSize, size),
          );
          return;
        case 'wait':
          await delay(Math.min(Math.max(action.ms, 0), 15_000));
          return;
        case 'navigate':
          await service.navigate(action.url);
          return;
        case 'go_back':
          service.goBack();
          return;
        case 'go_forward':
          service.goForward();
          return;
        case 'screenshot':
        case 'desconocida':
          return;
      }
    },
  };
}

type BrowserContents = ReturnType<IntegratedBrowserService['getWebContentsForAgent']>;
type ViewportSize = { width: number; height: number };

/**
 * Set-of-Marks del navegador. Apagado por omision: enciende con
 * `SOFLIA_BROWSER_SOM=1`. Se deja opt-in a proposito para poder medir con el
 * mismo binario si las marcas reducen pasos y clics fallidos antes de darlas
 * por buenas.
 */
export function browserMarksEnabled(): boolean {
  return process.env.SOFLIA_BROWSER_SOM === '1';
}

let sharpModule: SharpFactory | null | undefined;

function resolveSharp(): SharpFactory | null {
  if (sharpModule === undefined) sharpModule = loadSharp();
  return sharpModule;
}

/**
 * Dibuja las marcas sobre una COPIA de la captura. La observacion almacenada
 * queda intacta: esa misma imagen alimenta el respaldo visual del renderer y
 * los adjuntos del chat, y ahi las cajas numeradas serian ruido para la persona.
 *
 * Cualquier fallo devuelve la captura limpia. Una imagen sin marcar es peor que
 * una marcada, pero mucho mejor que un paso de Computer Use perdido.
 */
export async function markCapture(
  base64: string,
  dom: BrowserDomSnapshot,
  viewport: ViewportSize,
): Promise<{ base64: string; marks: BrowserMark[] }> {
  if (!browserMarksEnabled()) return { base64, marks: [] };
  const marks = buildBrowserMarks(dom, viewport, MAX_BROWSER_MARKS);
  // Con dos o tres controles el numero no desambigua nada y solo tapa contenido.
  if (marks.length < 3) return { base64, marks: [] };
  const sharp = resolveSharp();
  if (!sharp) return { base64, marks: [] };
  try {
    const marcada = await applySoMOverlay({
      sharp,
      base64,
      fallbackWidth: viewport.width,
      fallbackHeight: viewport.height,
      elements: marks,
      mapRect: (rect, imagen) => scaleRectToImage(rect, viewport, imagen),
    });
    return { base64: marcada, marks };
  } catch (error: unknown) {
    console.warn('[Navegador][SoM] No se pudieron dibujar las marcas:', error instanceof Error ? error.message : String(error));
    return { base64, marks: [] };
  }
}

/**
 * Leyenda textual de las marcas. El numero pintado dice donde esta el control;
 * esta lista dice que es, para que el modelo no tenga que inferirlo del pixel.
 */
function describeMarks(marks: BrowserMark[]): Array<Record<string, string | number>> {
  return marks.map((mark) => ({
    id: mark.id,
    nombre: mark.name.slice(0, 120),
    tipo: mark.controlType,
    ref: mark.ref,
  }));
}

/** La percepcion pasiva se codifica en JPEG; PNG sigue aceptandose por compatibilidad. */
function readDataUrlPayload(value: string | undefined): string | null {
  const match = typeof value === 'string' ? value.match(/^data:image\/(?:png|jpeg);base64,(.+)$/s) : null;
  return match ? match[1] : null;
}

function toViewportPoint(point: CuPoint, source: ViewportSize, target: ViewportSize): CuPoint {
  return {
    x: scaleCoordinate(point.x, source.width, target.width),
    y: scaleCoordinate(point.y, source.height, target.height),
  };
}

function scaleCoordinate(value: number, sourceExtent: number, targetExtent: number): number {
  const sourceMax = Math.max(1, sourceExtent - 1);
  const targetMax = Math.max(0, targetExtent - 1);
  const scaled = Math.round((value / sourceMax) * targetMax);
  return Math.max(0, Math.min(scaled, targetMax));
}

function normalizeCaptureSize(candidate: ViewportSize | undefined, fallback: ViewportSize): ViewportSize {
  if (!candidate || !Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) return fallback;
  const width = Math.round(candidate.width);
  const height = Math.round(candidate.height);
  return width > 0 && height > 0 ? { width, height } : fallback;
}

function sendClick(contents: BrowserContents, point: CuPoint, button: 'left' | 'right' | 'middle', clickCount: number): void {
  contents.sendInputEvent({ type: 'mouseDown', button, clickCount, ...point });
  contents.sendInputEvent({ type: 'mouseUp', button, clickCount, ...point });
}

function sendDrag(contents: BrowserContents, from: CuPoint, to: CuPoint): void {
  contents.sendInputEvent({ type: 'mouseMove', ...from });
  contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...from });
  contents.sendInputEvent({ type: 'mouseMove', modifiers: ['leftbuttondown'], ...to });
  contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...to });
}

function sendKey(contents: BrowserContents, rawCombination: string): void {
  const parts = rawCombination.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  const rawKey = parts.pop() || 'enter';
  const modifierMap: Record<string, NonNullable<InputEvent['modifiers']>[number]> = {
    ctrl: 'control', control: 'control', alt: 'alt', shift: 'shift', meta: 'meta', cmd: 'meta', command: 'meta', win: 'meta',
  };
  const keyMap: Record<string, string> = {
    enter: 'Enter', return: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: 'Space',
    backspace: 'Backspace', delete: 'Delete', up: 'Up', down: 'Down', left: 'Left', right: 'Right',
    home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  };
  const modifiers = parts.map((part) => modifierMap[part]).filter((value): value is NonNullable<InputEvent['modifiers']>[number] => Boolean(value));
  const keyCode = keyMap[rawKey] ?? (rawKey.length === 1 ? rawKey.toUpperCase() : rawKey);
  contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
