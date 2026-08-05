import type {
  BrowserDomSnapshot,
  IntegratedBrowserObservationResponse,
} from '../integrated-browser-service';

const MAX_TOOL_TEXT = 16_000;
const MAX_TOOL_HEADINGS = 60;
const MAX_TOOL_LANDMARKS = 40;
const MAX_TOOL_CONTROLS = 120;
const MAX_TOOL_FRAMES = 20;

/** Ejecuta capacidades DOM/navegación sin activar el actuador visual. */
export async function executeIntegratedBrowserTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const api = window.integratedBrowser;
  if (!api) return failure('El navegador integrado no está disponible.');

  if (toolName === 'read_browser_dom') {
    const state = await api.getState();
    if (!state.success || !state.state?.isVisible) {
      return failure('El navegador integrado no tiene una pestaña visible para leer.');
    }
    return serializeObservation(await api.getObservation(args.refresh !== false));
  }

  if (toolName === 'navigate_integrated_browser') {
    const state = await api.getState();
    if (!state.success || !state.state?.isVisible) {
      return failure('El navegador integrado no tiene una pestaña visible para navegar.');
    }
    const target = typeof args.target === 'string' ? args.target.trim() : '';
    if (!target || target.length > 2_048) {
      return failure('El destino debe ser una URL o consulta válida de hasta 2048 caracteres.');
    }
    const navigation = await api.navigate(target);
    if (!navigation.success) return failure(navigation.error || 'No fue posible navegar al destino solicitado.');
    return serializeObservation(await api.getObservation(true));
  }

  return failure('Herramienta de navegador no reconocida.');
}

function serializeObservation(result: IntegratedBrowserObservationResponse): string {
  if (!result.success || !result.state?.isVisible || !result.observation) {
    return failure(result.error || 'No fue posible obtener el DOM de la pestaña activa.');
  }

  const observation = result.observation;
  return JSON.stringify({
    success: true,
    source: 'integrated-browser-dom',
    observedAt: observation.capturedAt,
    tabId: observation.tabId,
    dom: compactDom(observation.dom),
    untrustedContent: true,
  });
}

function compactDom(dom: BrowserDomSnapshot): BrowserDomSnapshot {
  return {
    ...dom,
    text: dom.text.slice(0, MAX_TOOL_TEXT),
    headings: dom.headings.slice(0, MAX_TOOL_HEADINGS),
    landmarks: dom.landmarks.slice(0, MAX_TOOL_LANDMARKS),
    controls: dom.controls.slice(0, MAX_TOOL_CONTROLS),
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
