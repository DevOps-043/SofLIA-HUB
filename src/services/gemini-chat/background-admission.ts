import { BACKGROUND_LIMITS } from '../../shared/background-teams';
import { requestedTeamMode } from '../../shared/agent-teams/policy';
import { backgroundTeamsService } from '../background-teams';
import { resolveRoutedModel } from '../model-routing';
import { consumeSofliaMaxUse } from '../model-quota';
import { singleChunkStream, stoppedStreamResult } from './streams';
import type { ConversationMessage, SendMessageStreamOptions, StreamResult } from './types';

/** La admisión conserva mensaje/origen aunque su IPC concluya después de navegar. */
export async function admitBackgroundTurn(message: string, history: ConversationMessage[], options: SendMessageStreamOptions, workspaceId?: string): Promise<StreamResult> {
  const request = options.backgroundRequest;
  if (!request) throw new Error('El trabajo necesita una conversación de origen.');
  if (options.signal?.aborted) return stoppedStreamResult([], []);
  const routed = resolveRoutedModel({ options });
  const source = JSON.stringify({ mensajeConAdjuntosNoConfiables: message, fuentes: options.sourcesContext,
    contextoReciente: history.slice(-6), preferenciasDelUsuario: options.personalization,
  }).slice(0, BACKGROUND_LIMITS.sourceChars);
  const job = await backgroundTeamsService.start({
    // El mensaje es la clave estable: una repetición de admisión no duplica equipos.
    requestId: request.messageId, conversationId: request.conversationId, messageId: request.messageId,
    task: request.task.slice(0, 8000), source, model: routed.modelId,
    effort: options.thinking?.level && ['low', 'medium', 'high', 'xhigh', 'max'].includes(options.thinking.level) ? options.thinking.level : 'medium',
    allowResearch: options.browserSourceMode !== 'attached-fragments' && !message.startsWith('Material adjunto elegido por el usuario.'),
    ...(workspaceId ? { presentationWorkspaceId: workspaceId, executionMode: requestedTeamMode(request.task, options.teamMode) === 'direct' ? 'direct' as const : 'team' as const } : {}),
  }, request.organizationId, options.activityOwnerId);
  if (routed.consumesSofliaMaxQuota) consumeSofliaMaxUse(options.userId);
  let notice = 'Tu equipo ya está trabajando. Puedes seguir conversando o cambiar de chat; sus aportes y archivos aparecerán en esta conversación.';
  if (options.signal?.aborted && options.signal.reason?.kind !== 'navigation') {
    try { await backgroundTeamsService.control(job.id, 'cancel'); notice = 'El trabajo se canceló. Se conservan los archivos ya guardados.'; }
    catch { notice = 'No se pudo confirmar la cancelación del trabajo. Revisa su estado en esta conversación.'; }
  }
  return { backgroundJobId: job.id, backgroundNotice: notice, stream: singleChunkStream(notice), sources: Promise.resolve(null) };
}
