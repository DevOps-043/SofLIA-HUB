// Adjuntos de aplicaciones de escritorio en el turno del chat.
//
// La extraccion arranca al MARCAR, no al enviar: el usuario tiene que poder ver
// con que fidelidad se leyo cada aplicacion antes de mandar el mensaje. Saber
// que el modelo recibira una captura y no la hoja de calculo cambia lo que uno
// escribe, y a la hora de enviar ya seria tarde para enterarse.
//
// Al enviar solo se espera lo que siga pendiente, con presupuesto acotado.

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  desktopContextService,
  warningLabel,
  type DesktopAppContextAttachment,
  type DesktopContextLevel,
} from '../../../services/desktop-context-service';

export const APP_CONTEXT_LIMITS = {
  /** Tope agregado del turno, compartido con las pestanas adjuntas. */
  maxCharsPerTurn: 120_000,
  /** Espera maxima al enviar por las lecturas que sigan en curso. */
  extractionBudgetMs: 25_000,
} as const;

export type AppAttachmentStatus = 'pendiente' | 'listo' | 'error';

export interface AppContextAttachmentState {
  appId: string;
  title: string;
  appName: string;
  expectedLevel: DesktopContextLevel;
  status: AppAttachmentStatus;
  attachment?: DesktopAppContextAttachment;
  error?: string;
}

export type AppExtractionRegistry = MutableRefObject<Map<string, Promise<AppContextAttachmentState>>>;

export interface AppAttachmentsStore {
  attached: AppContextAttachmentState[];
  setAttached: Dispatch<SetStateAction<AppContextAttachmentState[]>>;
  extractions: AppExtractionRegistry;
}

/**
 * Lanza la lectura de una aplicacion recien marcada y refresca su chip cuando
 * termina. Si el usuario la desmarca antes, el refresco no encuentra la entrada
 * y no la reintroduce.
 */
export function startAppExtraction(entry: AppContextAttachmentState, store: AppAttachmentsStore): void {
  const promise = desktopContextService
    .captureApp(entry.appId)
    .then<AppContextAttachmentState>((res) =>
      res.success && res.attachment
        ? { ...entry, status: 'listo', attachment: res.attachment }
        : { ...entry, status: 'error', error: res.error || 'No se pudo leer la aplicación' },
    )
    .catch<AppContextAttachmentState>((error) => ({
      ...entry,
      status: 'error',
      error: error instanceof Error ? error.message : 'No se pudo leer la aplicación',
    }));

  store.extractions.current.set(entry.appId, promise);
  void promise.then((resolved) => {
    store.setAttached((list) => list.map((item) => (item.appId === resolved.appId ? resolved : item)));
  });
}

/** Espera las lecturas pendientes sin bloquear el turno mas alla del presupuesto. */
export async function resolveAppAttachments(
  entries: AppContextAttachmentState[],
  extractions: Map<string, Promise<AppContextAttachmentState>>,
  budgetMs: number = APP_CONTEXT_LIMITS.extractionBudgetMs,
): Promise<AppContextAttachmentState[]> {
  if (entries.length === 0) return [];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), budgetMs);
  });

  try {
    return await Promise.all(
      entries.map(async (entry) => {
        if (entry.status !== 'pendiente') return entry;
        const pending = extractions.get(entry.appId);
        if (!pending) {
          return { ...entry, status: 'error' as const, error: 'La lectura no llegó a iniciarse' };
        }
        const settled = await Promise.race([pending, deadline]);
        return settled === 'timeout'
          ? { ...entry, status: 'error' as const, error: 'La lectura superó el tiempo permitido' }
          : settled;
      }),
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface AppContextBlock {
  block: string;
  /** Capturas del nivel C, que viajan como imagenes del turno. */
  images: string[];
  charsUsed: number;
}

/**
 * Bloque de contexto para el modelo. Declara procedencia y avisos por
 * aplicacion para que una captura no se lea con la misma autoridad que un
 * documento completo.
 */
export function buildAppContextBlock(
  entries: AppContextAttachmentState[],
  maxChars: number,
): AppContextBlock {
  const parts: string[] = [];
  const images: string[] = [];
  let used = 0;

  entries.forEach((entry, index) => {
    const header = `--- Aplicación ${index + 1}: ${entry.title}${entry.appName ? ` (${entry.appName})` : ''} ---`;

    if (entry.status !== 'listo' || !entry.attachment) {
      parts.push(`${header}\nNo se pudo leer esta aplicación: ${entry.error ?? 'sin detalle'}. No infieras su contenido.`);
      return;
    }

    const attachment = entry.attachment;
    const lines = [header, `Procedencia: ${describeProvenance(attachment)}`];
    const avisos = attachment.warnings.map(warningLabel).filter(Boolean);
    if (avisos.length > 0) lines.push(`Avisos: ${avisos.join('; ')}.`);

    if (attachment.level === 'captura') {
      if (attachment.image) {
        images.push(attachment.image);
        lines.push('Contenido: imagen adjunta a este turno; limita tus afirmaciones a lo visible en ella.');
      } else {
        lines.push('Contenido: no disponible. No infieras lo que muestra esta ventana.');
      }
      parts.push(lines.join('\n'));
      return;
    }

    const remaining = maxChars - used;
    if (remaining <= 0) {
      parts.push(`${header}\nContenido omitido: se alcanzó el límite de contexto de este turno.`);
      return;
    }

    const body = attachment.text.slice(0, remaining);
    if (body.length < attachment.text.length) {
      lines.push('Aviso: contenido recortado por el límite de contexto de este turno.');
    }
    used += body.length;
    parts.push(`${lines.join('\n')}\n${body}`);
  });

  return { block: parts.join('\n\n'), images, charsUsed: used };
}

function describeProvenance(attachment: DesktopAppContextAttachment): string {
  switch (attachment.level) {
    case 'documento':
      return `documento completo leído del archivo "${attachment.source}"`;
    case 'accesibilidad':
      return `texto de la ventana "${attachment.source}" obtenido por accesibilidad`;
    default:
      return `captura de la ventana "${attachment.source}"; solo refleja lo visible en pantalla`;
  }
}
