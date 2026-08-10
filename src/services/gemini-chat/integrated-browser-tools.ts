import { requestUserConfirmation } from '../computer-use/confirmation';
import type {
  BrowserDomSnapshot,
  BrowserElementTargetSummary,
  IntegratedBrowserInteractionResponse,
  IntegratedBrowserObservationResponse,
} from '../integrated-browser-service';

const MAX_TOOL_TEXT = 16_000;
const MAX_TOOL_HEADINGS = 60;
const MAX_TOOL_LANDMARKS = 40;
const MAX_TOOL_CONTROLS = 120;
const MAX_TOOL_FRAMES = 20;
const MAX_TOOL_IMAGES = 16;

/**
 * Controles cuyo efecto no es reversible desde la propia pagina. El agente
 * puede navegar y abrir contenido por su cuenta, pero enviar, pagar o borrar
 * exige confirmacion explicita del usuario.
 */
const DESTRUCTIVE_CONTROL_PATTERN = /\b(enviar|env[ií]a|send|reply|responder|reenviar|forward|eliminar|borrar|delete|descartar|archivar|archive|pagar|pay|comprar|buy|checkout|suscribir|subscribe|confirmar|confirm|aceptar|publicar|post|tweet|transferir|cancelar suscripci|desactivar|cerrar sesi|log ?out|sign ?out)\b/i;

/** Ejecuta capacidades DOM/navegación sin activar el actuador visual. */
export async function executeIntegratedBrowserTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const api = window.integratedBrowser;
  if (!api) return failure('El navegador integrado no está disponible.');

  if (toolName === 'read_browser_dom') {
    const visible = await requireVisibleBrowser('leer');
    if (visible) return visible;
    return serializeObservation(await api.getObservation(args.refresh !== false));
  }

  if (toolName === 'navigate_integrated_browser') {
    const visible = await requireVisibleBrowser('navegar');
    if (visible) return visible;
    const target = typeof args.target === 'string' ? args.target.trim() : '';
    if (!target || target.length > 2_048) {
      return failure('El destino debe ser una URL o consulta válida de hasta 2048 caracteres.');
    }
    const navigation = await api.navigate(target);
    if (!navigation.success) return failure(navigation.error || 'No fue posible navegar al destino solicitado.');
    return serializeObservation(await api.getObservation(true));
  }

  if (toolName === 'click_browser_element') {
    const visible = await requireVisibleBrowser('interactuar');
    if (visible) return visible;
    const ref = readRef(args.ref);
    if (!ref) return failure('Indica el identificador "ref" de un control devuelto por read_browser_dom.');
    const denied = await confirmDestructiveInteraction(ref, args.reason);
    if (denied) return denied;
    const result = await api.clickElement(ref);
    if (!result.success) return failure(result.error || 'No fue posible hacer clic en el elemento indicado.');
    return serializeInteraction(result, await api.getObservation(true));
  }

  if (toolName === 'type_in_browser_element') {
    const visible = await requireVisibleBrowser('escribir');
    if (visible) return visible;
    const ref = readRef(args.ref);
    if (!ref) return failure('Indica el identificador "ref" de un campo devuelto por read_browser_dom.');
    if (typeof args.text !== 'string') return failure('El texto a escribir debe ser una cadena.');
    if (args.text.length > 5_000) return failure('El texto a escribir excede el límite de 5000 caracteres.');
    if (args.submit === true) {
      const confirmed = await requestUserConfirmation(
        'type_in_browser_element',
        `Escribir y enviar contenido mediante Enter en el navegador integrado.\nContenido: ${args.text.slice(0, 500)}`,
      );
      if (!confirmed) return failure('Acción cancelada por el usuario.');
    }
    const result = await api.typeInElement(ref, args.text, args.submit === true);
    if (!result.success) return failure(result.error || 'No fue posible escribir en el campo indicado.');
    return serializeInteraction(result, await api.getObservation(true));
  }

  if (toolName === 'scroll_integrated_browser') {
    const visible = await requireVisibleBrowser('desplazar');
    if (visible) return visible;
    const direction = args.direction;
    if (direction !== 'up' && direction !== 'down' && direction !== 'left' && direction !== 'right') {
      return failure('La dirección debe ser up, down, left o right.');
    }
    const amount = typeof args.amount === 'number' && Number.isFinite(args.amount)
      ? Math.min(20, Math.max(1, Math.round(args.amount)))
      : undefined;
    const result = await api.scrollView(direction, amount);
    if (!result.success) return failure(result.error || 'No fue posible desplazar la página.');
    return serializeObservation(await api.getObservation(true));
  }

  if (toolName === 'go_back_integrated_browser') {
    const visible = await requireVisibleBrowser('volver atrás en');
    if (visible) return visible;
    const result = await api.goBack();
    if (!result.success) return failure(result.error || 'No fue posible volver a la página anterior.');
    return serializeObservation(await api.getObservation(true));
  }

  return failure('Herramienta de navegador no reconocida.');
}

/** Devuelve un error serializado cuando no hay pestaña visible, o null si la hay. */
async function requireVisibleBrowser(action: string): Promise<string | null> {
  const state = await window.integratedBrowser!.getState();
  if (!state.success || !state.state?.isVisible) {
    return failure(`El navegador integrado no tiene una pestaña visible para ${action}.`);
  }
  return null;
}

async function confirmDestructiveInteraction(ref: string, reason: unknown): Promise<string | null> {
  const observation = await window.integratedBrowser!.getObservation(false);
  const control = observation.observation?.dom.controls.find((candidate) => candidate.ref === ref) ?? null;
  const label = [control?.name, control?.text, control?.type].filter(Boolean).join(' ').trim();
  if (!label || !DESTRUCTIVE_CONTROL_PATTERN.test(label)) return null;

  const motive = typeof reason === 'string' && reason.trim() ? `\nMotivo: ${reason.trim().slice(0, 200)}` : '';
  const confirmed = await requestUserConfirmation(
    'click_browser_element',
    `Hacer clic en un control con efecto irreversible dentro del navegador integrado.\nControl: ${label.slice(0, 160)}${motive}`,
  );
  return confirmed ? null : failure('Acción cancelada por el usuario.');
}

function readRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ref = value.trim();
  return ref && ref.length <= 60 ? ref : null;
}

function serializeInteraction(
  result: IntegratedBrowserInteractionResponse,
  observation: IntegratedBrowserObservationResponse,
): string {
  const dom = readObservationDom(observation);
  return JSON.stringify({
    success: true,
    source: 'integrated-browser-controller',
    acted: describeTarget(result.target),
    warning: result.warning ?? undefined,
    observedAt: observation.observation?.capturedAt,
    tabId: observation.observation?.tabId,
    dom: dom ?? undefined,
    domUnavailable: dom ? undefined : 'La acción se ejecutó, pero el DOM posterior no está disponible: vuelve a leerlo antes de continuar.',
    untrustedContent: true,
  });
}

function describeTarget(target?: BrowserElementTargetSummary): Record<string, unknown> | undefined {
  if (!target) return undefined;
  return {
    ref: target.ref,
    tag: target.tag,
    role: target.role,
    name: target.name,
    href: target.href,
  };
}

function serializeObservation(result: IntegratedBrowserObservationResponse): string {
  const dom = readObservationDom(result);
  if (!dom) return failure(result.error || 'No fue posible obtener el DOM de la pestaña activa.');

  return JSON.stringify({
    success: true,
    source: 'integrated-browser-dom',
    observedAt: result.observation!.capturedAt,
    tabId: result.observation!.tabId,
    dom,
    untrustedContent: true,
  });
}

function readObservationDom(result: IntegratedBrowserObservationResponse): BrowserDomSnapshot | null {
  if (!result.success || !result.state?.isVisible || !result.observation) return null;
  return compactDom(result.observation.dom);
}

function compactDom(dom: BrowserDomSnapshot): BrowserDomSnapshot {
  return {
    ...dom,
    text: dom.text.slice(0, MAX_TOOL_TEXT),
    headings: dom.headings.slice(0, MAX_TOOL_HEADINGS),
    landmarks: dom.landmarks.slice(0, MAX_TOOL_LANDMARKS),
    controls: dom.controls.slice(0, MAX_TOOL_CONTROLS),
    images: (dom.images ?? []).slice(0, MAX_TOOL_IMAGES),
    frames: dom.frames.slice(0, MAX_TOOL_FRAMES),
    truncated: dom.truncated
      || dom.text.length > MAX_TOOL_TEXT
      || dom.headings.length > MAX_TOOL_HEADINGS
      || dom.landmarks.length > MAX_TOOL_LANDMARKS
      || dom.controls.length > MAX_TOOL_CONTROLS
      || dom.frames.length > MAX_TOOL_FRAMES,
  };
}

function failure(error: string): string {
  return JSON.stringify({ success: false, error });
}
