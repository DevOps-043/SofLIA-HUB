/**
 * Deteccion pasiva de reuniones activas por ventana en primer plano.
 *
 * Multiplataforma via `active-win` (la misma dependencia que usa el
 * monitoring): en Windows/macOS/Linux entrega titulo + proceso. Cuando la
 * ventana activa parece una reunion (Zoom/Teams/Meet/Webex), se emite
 * 'meeting-detected' UNA vez por plataforma dentro de la ventana de cooldown;
 * la orbe decide si pregunta "¿Tomo notas?". Nunca inicia captura sola (HITL).
 */
import { EventEmitter } from 'node:events';

export type MeetingPlatform = 'zoom' | 'teams' | 'meet' | 'webex';

export interface DetectedMeeting {
  platform: MeetingPlatform;
  /** Nombre legible para la UI ("Zoom", "Google Meet"...). */
  platformLabel: string;
  windowTitle: string;
}

const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  meet: 'Google Meet',
  webex: 'Webex',
};

/**
 * Clasifica una ventana activa como reunion. Puro y testeable. Es deliberado
 * pedir señales de reunion EN CURSO (no basta con que la app este abierta:
 * la ventana principal de Teams/Zoom sin llamada no debe disparar el prompt).
 */
export function matchMeetingWindow(processName: string, title: string): DetectedMeeting | null {
  const proc = (processName || '').toLowerCase();
  const windowTitle = (title || '').trim();
  const lowerTitle = windowTitle.toLowerCase();

  // Google Meet vive en el navegador: el titulo de la pestaña es
  // "Meet – abc-defg-hij" o "Meet: abc-defg-hij" (Chrome usa dos puntos),
  // o contiene "Google Meet".
  if (/(^|[|•·—-]\s*)meet\s*[:–—-]\s*\S|google meet/i.test(windowTitle)) {
    return { platform: 'meet', platformLabel: PLATFORM_LABELS.meet, windowTitle };
  }
  if (/zoom/.test(proc) || /zoom/.test(lowerTitle)) {
    if (/zoom meeting|reuni[oó]n de zoom|zoom webinar|seminario web/i.test(windowTitle)) {
      return { platform: 'zoom', platformLabel: PLATFORM_LABELS.zoom, windowTitle };
    }
  }
  if (/teams/.test(proc) || /microsoft teams/.test(lowerTitle)) {
    if (/reuni[oó]n|meeting|llamada|call\b/i.test(windowTitle)) {
      return { platform: 'teams', platformLabel: PLATFORM_LABELS.teams, windowTitle };
    }
  }
  if (/webex/.test(proc) && /meeting|reuni[oó]n/i.test(windowTitle)) {
    return { platform: 'webex', platformLabel: PLATFORM_LABELS.webex, windowTitle };
  }
  return null;
}

export interface MeetingDetectorDeps {
  getActiveWindow: () => Promise<{ title: string; process: string } | null>;
  /** true mientras hay una sesion de transcripcion en curso (no re-prompt). */
  isCaptureActive: () => boolean;
  pollIntervalMs?: number;
  /** No volver a proponer la misma plataforma durante esta ventana. */
  cooldownMs?: number;
  now?: () => number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_COOLDOWN_MS = 3 * 60_000;
/** Una deteccion sin atender caduca: la reunion probablemente ya termino. */
const PENDING_DETECTION_MAX_AGE_MS = 10 * 60_000;

export class MeetingDetectorService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private lastPromptAt = new Map<MeetingPlatform, number>();
  private polling = false;
  private lastNearMissLoggedAt = 0;
  /**
   * Ultima deteccion NO atendida, como ESTADO consultable. El evento
   * 'meeting-detected' se pierde si la orbe aun no existe cuando dispara
   * (paso en produccion: deteccion antes de crear la ventana); la orbe
   * consulta esto al montarse y recupera el prompt perdido.
   */
  private pendingDetection: (DetectedMeeting & { detectedAt: number }) | null = null;

  constructor(private readonly deps: MeetingDetectorDeps) {
    super();
  }

  start(): void {
    if (this.timer) return;
    const interval = this.deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timer = setInterval(() => { void this.poll(); }, interval);
    console.log('[MeetingDetector] Deteccion pasiva de reuniones iniciada.');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Permite re-proponer de inmediato (p.ej. al terminar una sesion). */
  resetCooldown(platform?: MeetingPlatform): void {
    if (platform) this.lastPromptAt.delete(platform);
    else this.lastPromptAt.clear();
  }

  /** Deteccion pendiente de atender (fresca); null si no hay o ya caduco. */
  getPendingDetection(maxAgeMs = PENDING_DETECTION_MAX_AGE_MS): DetectedMeeting | null {
    if (!this.pendingDetection) return null;
    const now = this.deps.now ? this.deps.now() : Date.now();
    if (now - this.pendingDetection.detectedAt > maxAgeMs) {
      this.pendingDetection = null;
      return null;
    }
    return {
      platform: this.pendingDetection.platform,
      platformLabel: this.pendingDetection.platformLabel,
      windowTitle: this.pendingDetection.windowTitle,
    };
  }

  /** Marca la deteccion como atendida (sesion iniciada o propuesta rechazada). */
  clearPendingDetection(): void {
    this.pendingDetection = null;
  }

  private async poll(): Promise<void> {
    // Un poll lento (active-win puede tardar) no debe encimarse con el siguiente.
    if (this.polling || this.deps.isCaptureActive()) return;
    this.polling = true;
    try {
      const active = await this.deps.getActiveWindow();
      if (!active) return;
      const detected = matchMeetingWindow(active.process, active.title);
      if (!detected) {
        // Casi-deteccion: la ventana menciona una plataforma pero el matcher la
        // rechazo (app abierta sin llamada, o un formato de titulo no cubierto).
        // Log con throttle: es la evidencia clave para diagnosticar sin ruido.
        const mentionsPlatform = /meet|zoom|teams|webex/i.test(`${active.process} ${active.title}`);
        if (mentionsPlatform && Date.now() - this.lastNearMissLoggedAt > 60_000) {
          this.lastNearMissLoggedAt = Date.now();
          console.log(`[MeetingDetector] Ventana con plataforma pero sin reunion en curso: proceso="${active.process}" titulo="${active.title}"`);
        }
        return;
      }

      const now = this.deps.now ? this.deps.now() : Date.now();
      const cooldown = this.deps.cooldownMs ?? DEFAULT_COOLDOWN_MS;
      const lastAt = this.lastPromptAt.get(detected.platform) ?? 0;
      if (now - lastAt < cooldown) return;

      this.lastPromptAt.set(detected.platform, now);
      this.pendingDetection = { ...detected, detectedAt: now };
      console.log(`[MeetingDetector] Reunion detectada: ${detected.platformLabel} ("${detected.windowTitle}")`);
      this.emit('meeting-detected', detected);
    } catch (err) {
      console.warn('[MeetingDetector] Error al inspeccionar la ventana activa:', err instanceof Error ? err.message : String(err));
    } finally {
      this.polling = false;
    }
  }
}
