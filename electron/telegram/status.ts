import type { TelegramState } from './types';

export function buildTelegramStatus(state: TelegramState, polling: boolean): Record<string, any> {
  const configured = Boolean(state.config.botToken.trim());
  return {
    success: true,
    configured,
    enabled: state.config.enabled,
    polling,
    poll_interval_ms: state.config.pollIntervalMs,
    allowed_chat_ids: [...state.config.allowedChatIds],
    last_poll_at: state.lastPollAt || null,
    last_error: state.lastError || null,
    bot: state.botInfo || null,
    recent_chats: state.recentChats.slice(0, 20),
    available_agents: [
      { id: 'correo', command: '/correo triage', description: 'Ejecuta triage de Gmail con aprobacion.' },
      { id: 'agenda', command: '/agenda brief', description: 'Genera briefing diario de calendario.' },
      { id: 'ops', command: '/ops status', description: 'Muestra estado del sistema, runs y nodos.' },
    ],
  };
}
