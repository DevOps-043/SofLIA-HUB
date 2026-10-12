import { useAgentActivityPanel } from './agent-activity-context';
import { useEffect, useState } from 'react';
import { backgroundTeamsService } from '../../services/background-teams';
import { TeamFiles } from './TeamFiles';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import { backgroundFailureMessage, cleanTeamText, teamStatusLabels } from '../../shared/background-team-display';
import './team-results.css';

export function BackgroundChatResult({ jobId, messageId, conversationId }: { jobId: string; messageId: string; conversationId?: string }) {
  const panel = useAgentActivityPanel();
  const item = panel?.items.find(activity => activity.execution?.id === jobId);
  const execution = item?.execution;
  const linkedMessageId = execution?.messageId;
  const linkedConversationId = execution?.conversationId;
  const [attachError, setAttachError] = useState(false);
  useEffect(() => {
    if (linkedMessageId || !linkedConversationId?.startsWith('borrador:') || !conversationId) return;
    let active = true;
    void backgroundTeamsService.attachLegacy({ jobId, messageId, conversationId }).catch(() => { if (active) setAttachError(true); });
    return () => { active = false; };
  }, [linkedMessageId, linkedConversationId, conversationId, jobId, messageId]);
  if (!execution || !item) return <p className="mt-3 text-xs text-secondary">Los resultados de este equipo se mostrarán aquí cuando su contexto esté disponible.</p>;
  const matchesConversation = execution.conversationId.startsWith('borrador:') || execution.conversationId === conversationId;
  const matchesMessage = execution.messageId ? execution.messageId === messageId : execution.conversationId === conversationId;
  if (!matchesConversation || !matchesMessage) return <p className="mt-3 text-xs text-secondary">{attachError ? 'No se pudo asociar este resultado al mensaje de origen.' : 'Comprobando el vínculo con el mensaje de origen…'}</p>;
  const active = ['running', 'queued', 'verifying'].includes(execution.status);
  return <section className="team-chat-result" aria-label="Trabajo del equipo" aria-live="polite">
    <header className="team-result-header">
      {active && <span className="team-spinner" />}
      <h3>{teamStatusLabels[execution.status]}</h3>
    </header>
    {(!execution.summary || active) && <p className="team-result-overview">{active ? 'Estoy preparando los resultados. Puedes continuar la conversación.' :
      execution.status === 'completed' ? `Preparé ${execution.artifacts.length} ${execution.artifacts.length === 1 ? 'archivo' : 'archivos'}. Puedes revisarlos aquí.` :
      execution.status === 'cancelled' ? 'El trabajo se canceló. Aquí se conservan los archivos guardados.' :
      execution.artifacts.length ? 'El trabajo quedó pendiente. Los archivos ya guardados están disponibles aquí.' : 'El trabajo quedó pendiente y todavía no hay archivos disponibles.'}</p>}
    {execution.summary && <div className="team-markdown"><MarkdownRenderer text={cleanTeamText(execution.summary)} /></div>}
    {execution.status === 'failed' && <p className="team-operation-error">{backgroundFailureMessage(execution.error)}</p>}
    {execution.artifacts.length > 0 && <TeamFiles jobId={jobId} files={execution.artifacts} />}
  </section>;
}

