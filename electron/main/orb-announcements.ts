import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { canUseProtectedFeature } from './require-auth';

/**
 * Cola de anuncios proactivos de la orbe.
 *
 * Es la primera vez que el producto habla sin que el usuario haya iniciado la
 * conversacion, y por eso la cola no es un detalle de implementacion: dos
 * Skills pasivas programadas a las 8:00 se dispararian en el mismo minuto y sus
 * dos voces se superpondrian. Los anuncios se entregan de uno en uno y el
 * siguiente espera al acuse del renderer.
 *
 * El relevo por `pendingAnnouncement` repite el patron ya usado para el wake
 * word: un push a una ventana recien creada se pierde si React todavia no monto
 * sus listeners, asi que el renderer lo reclama al montarse.
 */

export interface OrbAnnouncement {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

interface OrbAnnouncementsOptions {
  getWindow: () => BrowserWindow | null;
  showWindow: () => Promise<void>;
}

export function createOrbAnnouncements(options: OrbAnnouncementsOptions) {
  const queue: OrbAnnouncement[] = [];
  let inFlight: OrbAnnouncement | null = null;
  /** Anuncio ya emitido que el renderer aun no reclamo (ventana recien creada). */
  let pending: OrbAnnouncement | null = null;

  const send = (announcement: OrbAnnouncement): boolean => {
    const win = options.getWindow();
    if (!win || win.isDestroyed()) return false;
    win.webContents.send('orb:announce', announcement);
    return true;
  };

  const pump = async (): Promise<void> => {
    if (inFlight || queue.length === 0) return;

    // La guarda se comprueba en cada entrega, no solo al encolar: la sesion
    // pudo cerrarse mientras el anuncio esperaba su turno.
    if (!canUseProtectedFeature()) {
      console.warn('[OrbAnuncios] Sin sesion iniciada: se descartan los anuncios pendientes.');
      clear();
      return;
    }

    const next = queue.shift();
    if (!next) return;
    inFlight = next;

    await options.showWindow();
    pending = next;
    // Si la ventana ya esta viva, el push llega; si acaba de crearse, el
    // renderer lo reclamara con `orb:get-pending-announcement`.
    send(next);
  };

  const clear = (): void => {
    queue.length = 0;
    inFlight = null;
    pending = null;
  };

  return {
    /** Encola un anuncio y arranca la entrega si no hay otra en curso. */
    async announce(text: string, meta: { title: string }): Promise<void> {
      const contenido = String(text || '').replace(/\s+/g, ' ').trim();
      if (!contenido) return;

      // Negacion por defecto: sin sesion no se muestra la orbe ni se locuta
      // nada. Es la misma guarda que ya rige el wake word y el atajo global.
      if (!canUseProtectedFeature()) {
        console.warn('[OrbAnuncios] Anuncio omitido: no hay sesion iniciada.');
        return;
      }

      queue.push({
        id: randomUUID(),
        title: String(meta.title || 'SofLIA').trim(),
        text: contenido,
        createdAt: new Date().toISOString(),
      });
      await pump();
    },

    /** Lo reclama el renderer al montarse, para no perder el push. */
    consumePending(): OrbAnnouncement | null {
      const anuncio = pending;
      pending = null;
      return anuncio;
    },

    /** Acuse del renderer al terminar la locucion: libera el siguiente. */
    async finish(announcementId: string | null): Promise<void> {
      // Un acuse de un anuncio que ya no esta en curso se ignora: llega cuando
      // la cola se vacio por cierre de sesion, y liberar ahi adelantaria un
      // anuncio que no deberia sonar.
      if (!inFlight || (announcementId && announcementId !== inFlight.id)) return;
      inFlight = null;
      await pump();
    },

    /** Vacia la cola. Uso previsto: cierre de sesion. */
    clear,

    /** Solo para diagnostico y pruebas. */
    size(): number {
      return queue.length + (inFlight ? 1 : 0);
    },
  };
}

export type OrbAnnouncements = ReturnType<typeof createOrbAnnouncements>;
