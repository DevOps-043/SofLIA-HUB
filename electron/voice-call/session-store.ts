import { readVoiceCallConfig } from './config';
import type {
  VoiceCallChannel,
  VoiceCallCloseReason,
  VoiceCallOpenReason,
  VoiceCallSession,
} from './types';

/**
 * Registro de sesiones de modo llamada.
 *
 * El vencimiento se evalua al consultar, no con temporizadores: una sesion que
 * nadie mira no necesita despertarse para caducar, y sin temporizadores no hay
 * handles que limpiar al desconectar un canal.
 */
export class VoiceCallSessionStore {
  private readonly sessions = new Map<string, VoiceCallSession>();

  /**
   * Abre o renueva la sesion. Reabrir una ya viva solo refresca la actividad:
   * asi hablarle durante una llamada en curso no reinicia el conteo de turnos ni
   * repite el saludo.
   */
  open(channel: VoiceCallChannel, chatId: string, reason: VoiceCallOpenReason): VoiceCallSession {
    const existing = this.get(channel, chatId);
    if (existing) {
      existing.lastActivityAt = Date.now();
      return existing;
    }
    const now = Date.now();
    const session: VoiceCallSession = {
      channel,
      chatId,
      openedAt: now,
      lastActivityAt: now,
      openReason: reason,
      spokenTurns: 0,
      degradedNoticeSent: false,
    };
    this.sessions.set(buildKey(channel, chatId), session);
    return session;
  }

  /** Devuelve la sesion viva, o `null` si no existe o ya caduco. */
  get(channel: VoiceCallChannel, chatId: string): VoiceCallSession | null {
    const key = buildKey(channel, chatId);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (Date.now() - session.lastActivityAt > readVoiceCallConfig().idleTimeoutMs) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  isActive(channel: VoiceCallChannel, chatId: string): boolean {
    return this.get(channel, chatId) !== null;
  }

  /** Marca actividad y cuenta el turno hablado. */
  recordSpokenTurn(channel: VoiceCallChannel, chatId: string): void {
    const session = this.get(channel, chatId);
    if (!session) return;
    session.lastActivityAt = Date.now();
    session.spokenTurns += 1;
  }

  /** Refresca la actividad sin contar turno, para entradas que aun no responden. */
  touch(channel: VoiceCallChannel, chatId: string): void {
    const session = this.get(channel, chatId);
    if (session) session.lastActivityAt = Date.now();
  }

  /**
   * Reserva el aviso de caida a texto. Devuelve `true` solo la primera vez de la
   * sesion, para que un proveedor caido no repita la misma disculpa en cada turno.
   */
  claimDegradedNotice(channel: VoiceCallChannel, chatId: string): boolean {
    const session = this.get(channel, chatId);
    if (!session || session.degradedNoticeSent) return false;
    session.degradedNoticeSent = true;
    return true;
  }

  /** Cierra la sesion. Devuelve la que estaba viva, o `null` si no habia ninguna. */
  close(channel: VoiceCallChannel, chatId: string, reason: VoiceCallCloseReason): VoiceCallSession | null {
    const session = this.get(channel, chatId);
    if (!session) return null;
    this.sessions.delete(buildKey(channel, chatId));
    console.log(`[Voice Call] Sesion cerrada (${reason}) en ${channel}:${chatId} tras ${session.spokenTurns} turnos hablados.`);
    return session;
  }

  /** Cierra todas las sesiones de un canal que se desconecto. */
  closeChannel(channel: VoiceCallChannel): number {
    let closed = 0;
    for (const [key, session] of this.sessions) {
      if (session.channel !== channel) continue;
      this.sessions.delete(key);
      closed += 1;
    }
    return closed;
  }

  /** Sesiones vivas, para diagnostico. */
  listActive(): VoiceCallSession[] {
    const idleTimeoutMs = readVoiceCallConfig().idleTimeoutMs;
    const now = Date.now();
    const active: VoiceCallSession[] = [];
    for (const [key, session] of this.sessions) {
      if (now - session.lastActivityAt > idleTimeoutMs) {
        this.sessions.delete(key);
        continue;
      }
      active.push(session);
    }
    return active;
  }
}

function buildKey(channel: VoiceCallChannel, chatId: string): string {
  return `${channel}:${chatId}`;
}

/** Registro compartido por el transporte de ambos canales. */
export const voiceCallSessions = new VoiceCallSessionStore();
