import { buildSkillsCatalogText } from '../skill-catalog/channel-skills';
import type { TelegramRuntimeContext } from './types';

export function buildTelegramHelpMessage(): string {
  return [
    'Comandos disponibles:',
    '/skills — que se hacer por aqui',
    '/llamar — hablamos por nota de voz y te contesto hablando',
    '/colgar — termina la llamada',
    '/nodes',
    '/node test NODE_ID',
    '',
    'Tambien puedes mandarme una nota de voz: la escucho y te respondo con voz.',
  ].join('\n');
}

/** Catalogo de Skills de este chat. Misma fuente que el chat del Hub y WhatsApp. */
export function buildSkillsMessage(
  context: TelegramRuntimeContext,
  chatId: string,
  isGroup: boolean,
): Promise<string> {
  return buildSkillsCatalogText({
    surface: 'telegram',
    userId: resolveUserId(context, chatId),
    isGroup,
  });
}

export async function buildOpsStatusMessage(context: TelegramRuntimeContext): Promise<string> {
  const status = {
    enabled: context.state.config.enabled,
    polling: context.isPolling(),
    bot: context.state.botInfo,
    last_poll_at: context.state.lastPollAt,
    recent_chats: context.state.recentChats,
  };
  return [
    'Estado operativo SofLIA:',
    `Telegram: ${status.enabled ? 'habilitado' : 'deshabilitado'} / ${status.polling ? 'polling activo' : 'polling detenido'}`,
    `Bot: ${status.bot?.username || status.bot?.first_name || 'sin-bot'}`,
    `Ultimo poll: ${status.last_poll_at || 'n/a'}`,
    `Chats recientes: ${status.recent_chats?.length || 0}`,
  ].join('\n');
}

export async function buildNodesMessage(context: TelegramRuntimeContext): Promise<string> {
  const host = await context.deps!.remoteNodeService.getHostStatus();
  const nodes = await context.deps!.remoteNodeService.listNodes();
  return [
    'Estado de nodos:',
    `Host remoto: ${host.running ? 'activo' : 'inactivo'} en ${host.local_url}`,
    `Nodo local: ${host.node_name}`,
    `Nodos registrados: ${nodes.length}`,
    ...nodes.slice(0, 8).map((node) => `- ${node.id} | ${node.name} | ${node.baseUrl} | ${node.lastHealthAt ? 'ok' : 'sin-health'}`),
  ].join('\n');
}

/**
 * Identidad del usuario detras del chat, para acotar por sus canales activos.
 * Sin identidad resuelta manda el catalogo, que es el comportamiento por
 * omision documentado: la ausencia de eleccion no retira una capacidad.
 */
export function resolveUserId(context: TelegramRuntimeContext, chatId: string): string | null {
  try {
    return context.deps?.communicationHubService?.getTelegramUserId(chatId) ?? null;
  } catch {
    return null;
  }
}
