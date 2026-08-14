import { requestUserConfirmation } from '../computer-use/confirmation';
import {
  MEDIA_BUDGET,
  buildPlaybackWindow,
  clampWindow,
} from '../../shared/multimodal-input';
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

  if (toolName === 'capturar_vista_navegador') {
    const visible = await requireVisibleBrowser('ver');
    if (visible) return visible;
    const captura = await api.captureFrame();
    if (!captura?.success || !captura.capture) {
      return failure(captura?.error || 'No pude capturar la vista del navegador.');
    }
    if (!captura.capture.ok) {
      // La degradacion se declara tal cual: describir una escena que no se
      // capturo es exactamente lo que esta herramienta existe para evitar.
      return JSON.stringify({
        success: false,
        evidencia: 'no-disponible',
        motivo: captura.capture.reason,
        detalle: captura.capture.detail,
        instruccion: 'No describas la escena. Explica al usuario que no puedes verla y por que.',
      });
    }
    return JSON.stringify({
      success: true,
      capturada_en: captura.capture.capturedAt,
      url: captura.capture.url,
      resolucion: args.detalle === true ? 'alta' : 'normal',
      captura: captura.capture.screenshot,
    });
  }

  if (toolName === 'analizar_video_pestana') {
    const visible = await requireVisibleBrowser('analizar el video de');
    if (visible) return visible;
    return analyzeTabVideo(api, args);
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
/**
 * Analiza el video de la pestaña activa.
 *
 * Dos rutas, en este orden. La primera es la buena: un video publico
 * direccionable viaja al proveedor por su URI y se procesa del lado servidor
 * con su pista de audio, sin que el equipo transfiera nada. La segunda es una
 * degradacion honesta: un reproductor no direccionable —contenido autenticado,
 * reproductor propietario— solo puede entregarse como muestreo de cuadros, sin
 * audio y sin continuidad, y el resultado lo declara para que la respuesta no
 * hable del video como si lo hubiera visto entero.
 */
async function analyzeTabVideo(
  api: NonNullable<typeof window.integratedBrowser>,
  args: Record<string, unknown>,
): Promise<string> {
  const estado = await api.getPlayerState();
  const player = estado?.success ? estado.player : null;
  if (!player?.hasVideo) {
    return failure('No hay ningun video en reproduccion en la pestaña activa.');
  }

  const ventana = resolveRequestedWindow(args.ventana_segundos);
  const posicionConocida = player.currentTimeSeconds !== null;

  if (player.publicVideoUrl) {
    const base = buildPlaybackWindow(player.currentTimeSeconds, player.durationSeconds ?? undefined);
    // La ventana pedida se cuenta desde el inicio ya alineado con la
    // reproduccion; `clampWindow` la recorta al medio y al maximo del turno.
    const acotada = clampWindow(
      { startSeconds: base.startSeconds, endSeconds: base.startSeconds + ventana },
      player.durationSeconds ?? undefined,
    );
    return JSON.stringify({
      success: true,
      evidencia: 'video',
      fuente: player.publicVideoUrl,
      intervalo_segundos: { inicio: acotada.startSeconds, fin: acotada.endSeconds },
      posicion_alineada: posicionConocida,
      nota: posicionConocida
        ? 'El video va adjunto acotado a ese intervalo, con su audio.'
        : 'No pude leer la posicion de reproduccion: el intervalo arranca al inicio del medio. Dilo al responder.',
      __media: [{
        kind: 'public-video',
        uri: player.publicVideoUrl,
        durationSeconds: player.durationSeconds ?? undefined,
        window: acotada,
      }],
    });
  }

  const muestreo = await api.sampleFrames(MEDIA_BUDGET.frameSampleCount, MEDIA_BUDGET.frameSampleIntervalSeconds * 1000);
  if (!muestreo?.success) return failure(muestreo?.error || 'No pude muestrear el video de la pestaña.');
  const cuadros = muestreo.frames ?? [];
  if (!cuadros.length) {
    const fallo = muestreo.failure;
    return JSON.stringify({
      success: false,
      evidencia: 'no-disponible',
      motivo: fallo && !fallo.ok ? fallo.reason : 'muestreo-vacio',
      detalle: fallo && !fallo.ok ? fallo.detail : 'No pude obtener ningun cuadro del video.',
      instruccion: 'No describas la escena. Explica al usuario que no puedes verla y por que.',
    });
  }

  return JSON.stringify({
    success: true,
    evidencia: 'muestreo-de-cuadros',
    cuadros: cuadros.length,
    marcas_de_tiempo: cuadros.map((frame) => Math.round(frame.atSeconds)),
    nota: 'Este video no es publicamente direccionable, asi que la evidencia es un MUESTREO de cuadros sin audio, no el video completo. Dilo explicitamente al responder.',
    __media: [{
      kind: 'frames',
      frames: cuadros.map((frame) => ({
        base64: frame.screenshot.slice(frame.screenshot.indexOf(',') + 1),
        mimeType: 'image/jpeg',
        atSeconds: frame.atSeconds,
      })),
    }],
  });
}

function resolveRequestedWindow(value: unknown): number {
  const segundos = Number(value);
  if (!Number.isFinite(segundos) || segundos <= 0) return 40;
  return Math.min(MEDIA_BUDGET.maxVideoWindowSeconds, Math.floor(segundos));
}

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
