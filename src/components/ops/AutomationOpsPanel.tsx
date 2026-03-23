import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveAutomationRun,
  createCustomAutomationTemplate,
  executeAutomationTemplate,
  isAutomationAvailable,
  listAutomationRuns,
  listAutomationTemplates,
  rejectAutomationRun,
  type WorkflowTemplateDefinition,
  type WorkflowRunRecord,
} from '../../services/automation-service';
import { isGChatAvailable, listGChatSpaces, type ChatSpace } from '../../services/gchat-service';
import {
  getRemoteNodeHostStatus,
  isRemoteNodeAvailable,
  listRemoteNodes,
  registerRemoteNode,
  takeRemoteNodeScreenshot,
  testRemoteNode,
  updateRemoteNodeHostConfig,
  type RemoteNodeHostStatus,
  type RemoteNodeRecord,
} from '../../services/remote-node-service';
import {
  getTelegramStatus,
  isTelegramAvailable,
  listTelegramRecentChats,
  testTelegramConnection,
  updateTelegramConfig,
  type TelegramRecentChat,
  type TelegramStatusSnapshot,
} from '../../services/telegram-service';

interface AutomationOpsPanelProps {
  userId: string;
}

type TriagePresetId = 'today' | 'unread' | 'priority' | 'custom';

const TRIAGE_PRESETS: Array<{
  id: TriagePresetId;
  label: string;
  description: string;
  query: string;
}> = [
  {
    id: 'today',
    label: 'Correos nuevos de hoy',
    description: 'Ideal para revisar lo mas reciente sin configurar nada.',
    query: 'in:inbox newer_than:1d',
  },
  {
    id: 'unread',
    label: 'Correos pendientes de responder',
    description: 'Busca mensajes no leidos de los ultimos dias.',
    query: 'in:inbox is:unread newer_than:7d',
  },
  {
    id: 'priority',
    label: 'Correos importantes',
    description: 'Prioriza conversaciones de la bandeja principal.',
    query: 'in:inbox category:primary newer_than:7d',
  },
  {
    id: 'custom',
    label: 'Filtro avanzado',
    description: 'Para quien ya conoce filtros de Gmail.',
    query: 'in:inbox newer_than:7d',
  },
];

const RUN_STATUS_LABELS: Record<string, string> = {
  needs_approval: 'Por autorizar',
  completed: 'Completado',
  failed: 'Con error',
  rejected: 'No autorizado',
  cancelled: 'Cancelado',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  executed: 'Ejecutada',
  failed: 'Con error',
  skipped: 'Omitida',
};

const TEMPLATE_LABELS: Record<string, string> = {
  gmail_triage: 'Revisión de correo',
  calendar_daily_brief: 'Resumen de agenda',
  gmail_followup_draft: 'Correo de seguimiento',
  calendar_meeting_prep: 'Preparacion de reunion',
  drive_project_workspace: 'Espacio de proyecto en Drive',
  gchat_executive_update: 'Actualizacion ejecutiva en Chat',
  desktop_action: 'Accion en mi computadora',
};

const ACTION_KIND_LABELS: Record<string, string> = {
  gmail_labels: 'Etiquetas en Gmail',
  gmail_reply: 'Respuesta por Gmail',
  gmail_send: 'Correo nuevo por Gmail',
  calendar_event: 'Evento de calendario',
  gchat_message: 'Mensaje en Google Chat',
  drive_folder_tree: 'Estructura en Google Drive',
  desktop_task: 'Accion en la computadora',
};

const FIELD_LABELS: Record<string, string> = {
  summary: 'Resumen',
  rationale: 'Motivo',
  confidence: 'Confianza',
  keyPoints: 'Puntos clave',
  risks: 'Riesgos',
  talkingPoints: 'Puntos sugeridos',
  chatDraft: 'Mensaje sugerido',
  decision: 'Decision',
  labelsToAdd: 'Etiquetas',
  archive: 'Archivar',
  messageId: 'Correo',
  addLabels: 'Etiquetas nuevas',
  removeLabels: 'Etiquetas a quitar',
  to: 'Para',
  subject: 'Asunto',
  body: 'Mensaje',
  spaceName: 'Google Chat',
  text: 'Texto',
  message: 'Mensaje',
  title: 'Titulo',
  start: 'Inicio',
  end: 'Fin',
  description: 'Descripcion',
  location: 'Ubicacion',
  task: 'Tarea',
  projectName: 'Proyecto',
  folders: 'Carpetas',
  parentFolderId: 'Carpeta padre',
  topic: 'Tema',
  objective: 'Objetivo',
  steps: 'Pasos',
  missingData: 'Datos faltantes',
  guidance: 'Guia',
};

const RUN_STATUS_STYLES: Record<string, string> = {
  needs_approval: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  rejected: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  cancelled: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

const ACTION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  executed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  skipped: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

function badgeTone(value: string, map: Record<string, string>): string {
  return map[value] || 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20';
}

function prettyStatus(value: string): string {
  return RUN_STATUS_LABELS[value] || ACTION_STATUS_LABELS[value] || value.replace(/_/g, ' ');
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'n/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => previewValue(item)).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (value === null || value === undefined || value === '') return 'n/d';
  return String(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function prettyTemplateId(value: string): string {
  if (value.startsWith('custom_')) {
    return 'Flujo propio';
  }
  return TEMPLATE_LABELS[value] || value.replace(/_/g, ' ');
}

function prettyActionKind(value: string): string {
  return ACTION_KIND_LABELS[value] || value.replace(/_/g, ' ');
}

function prettyFieldLabel(value: string): string {
  return FIELD_LABELS[value] || value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function StatusBadge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide border ${badgeTone(value, styles)}`}>
      {prettyStatus(value)}
    </span>
  );
}

export const AutomationOpsPanel: React.FC<AutomationOpsPanelProps> = ({ userId }) => {
  const bridge = useMemo(() => ({
    automation: isAutomationAvailable(),
    telegram: isTelegramAvailable(),
    remoteNode: isRemoteNodeAvailable(),
    gchat: isGChatAvailable(),
  }), []);
  const [templates, setTemplates] = useState<WorkflowTemplateDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [recentChats, setRecentChats] = useState<TelegramRecentChat[]>([]);
  const [hostStatus, setHostStatus] = useState<RemoteNodeHostStatus | null>(null);
  const [nodes, setNodes] = useState<RemoteNodeRecord[]>([]);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [triagePreset, setTriagePreset] = useState<TriagePresetId>('unread');
  const [triageQuery, setTriageQuery] = useState('');
  const [triageMaxResults, setTriageMaxResults] = useState(5);
  const [triageChatSpace, setTriageChatSpace] = useState('');
  const [briefDate, setBriefDate] = useState(new Date().toISOString().slice(0, 10));
  const [briefChatSpace, setBriefChatSpace] = useState('');
  const [followupTo, setFollowupTo] = useState('');
  const [followupTopic, setFollowupTopic] = useState('');
  const [followupContext, setFollowupContext] = useState('');
  const [meetingPrepDate, setMeetingPrepDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingPrepChatSpace, setMeetingPrepChatSpace] = useState('');
  const [driveProjectName, setDriveProjectName] = useState('');
  const [driveParentFolderId, setDriveParentFolderId] = useState('');
  const [driveChatSpace, setDriveChatSpace] = useState('');
  const [executiveChatSpace, setExecutiveChatSpace] = useState('');
  const [executiveContext, setExecutiveContext] = useState('');
  const [executiveTone, setExecutiveTone] = useState('ejecutivo y claro');
  const [desktopObjective, setDesktopObjective] = useState('');
  const [desktopBackend, setDesktopBackend] = useState('auto');
  const [desktopStartUrl, setDesktopStartUrl] = useState('');
  const [customFlowName, setCustomFlowName] = useState('');
  const [customFlowObjective, setCustomFlowObjective] = useState('');
  const [customFlowDetails, setCustomFlowDetails] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramAllowedChats, setTelegramAllowedChats] = useState('');
  const [telegramPollInterval, setTelegramPollInterval] = useState(8000);
  const [nodeName, setNodeName] = useState('');
  const [nodeBaseUrl, setNodeBaseUrl] = useState('http://127.0.0.1:47825');
  const [nodeToken, setNodeToken] = useState('');
  const [remoteImage, setRemoteImage] = useState<{ nodeId: string; image: string; capturedAt: string } | null>(null);
  const [telegramHydrated, setTelegramHydrated] = useState(false);
  const [activeAction, setActiveAction] = useState<'triage' | 'brief' | 'followup' | 'meeting' | 'drive' | 'chat' | 'desktop' | 'custom'>('triage');

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId],
  );
  const customTemplates = useMemo(
    () => templates.filter((template) => template.kind === 'custom'),
    [templates],
  );
  const selectedCustomTemplate = useMemo(
    () => customTemplates.find((template) => template.id === selectedCustomTemplateId) || null,
    [customTemplates, selectedCustomTemplateId],
  );
  const pendingRuns = useMemo(
    () => runs.filter((run) => run.status === 'needs_approval'),
    [runs],
  );
  const effectiveTriageQuery = useMemo(() => {
    if (triagePreset === 'custom') {
      return triageQuery.trim() || TRIAGE_PRESETS.find((preset) => preset.id === 'custom')?.query || 'in:inbox newer_than:7d';
    }
    return TRIAGE_PRESETS.find((preset) => preset.id === triagePreset)?.query || 'in:inbox newer_than:7d';
  }, [triagePreset, triageQuery]);

  const refreshOverview = useCallback(async (preserveSelection = true) => {
    const tasks: Array<Promise<void>> = [];

    if (bridge.automation) {
      tasks.push((async () => {
        const templatesResult = await listAutomationTemplates();
        if (!templatesResult.success) throw new Error(templatesResult.error || 'No pude cargar los flujos.');
        const nextTemplates = templatesResult.templates || [];
        setTemplates(nextTemplates);
        setSelectedCustomTemplateId((current) => {
          if (current && nextTemplates.some((template) => template.id === current && template.kind === 'custom')) {
            return current;
          }
          return nextTemplates.find((template) => template.kind === 'custom')?.id || null;
        });
      })());

      tasks.push((async () => {
        const runsResult = await listAutomationRuns(30);
        if (!runsResult.success) throw new Error(runsResult.error || 'No pude cargar los casos.');
        const nextRuns = runsResult.runs || [];
        setRuns(nextRuns);
        setSelectedRunId((current) => {
          if (preserveSelection && current && nextRuns.some((run) => run.id === current)) return current;
          return nextRuns[0]?.id || null;
        });
      })());
    }

    if (bridge.gchat) {
      tasks.push((async () => {
        const result = await listGChatSpaces();
        if (result.success) setSpaces(result.spaces || []);
      })());
    }

    if (bridge.telegram) {
      tasks.push((async () => {
        const [statusResult, chatsResult] = await Promise.all([
          getTelegramStatus(),
          listTelegramRecentChats(),
        ]);
        if (!statusResult.success) throw new Error(statusResult.error || 'No pude cargar Telegram.');
        setTelegramStatus(statusResult);
        setRecentChats(chatsResult.success ? (chatsResult.chats || []) : []);
        if (!telegramHydrated) {
          setTelegramEnabled(statusResult.enabled);
          setTelegramAllowedChats((statusResult.allowed_chat_ids || []).join(', '));
          setTelegramPollInterval(statusResult.poll_interval_ms || 8000);
          setTelegramHydrated(true);
        }
      })());
    }

    if (bridge.remoteNode) {
      tasks.push((async () => {
        const [hostResult, nodesResult] = await Promise.all([
          getRemoteNodeHostStatus(),
          listRemoteNodes(),
        ]);
        setHostStatus(hostResult);
        if (!nodesResult.success) throw new Error(nodesResult.error || 'No pude cargar nodos.');
        setNodes(nodesResult.nodes || []);
      })());
    }

    await Promise.all(tasks);
  }, [bridge.automation, bridge.gchat, bridge.remoteNode, bridge.telegram, telegramHydrated]);

  useEffect(() => {
    void refreshOverview(false).catch((currentError: unknown) => {
      setError(getErrorMessage(currentError) || 'No pude cargar la consola.');
    });
    const intervalId = window.setInterval(() => {
      void refreshOverview(true).catch(() => {});
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [refreshOverview]);

  const runAction = useCallback(async (key: string, callback: () => Promise<void>) => {
    setActionKey(key);
    setError(null);
    setNotice(null);
    try {
      await callback();
    } catch (currentError: unknown) {
      setError(getErrorMessage(currentError) || 'La accion fallo.');
    } finally {
      setActionKey(null);
    }
  }, []);

  const inputClass = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/35 focus:ring-1 focus:ring-accent/20 transition';
  const textareaClass = `${inputClass} min-h-[88px] resize-y`;

  if (!bridge.automation && !bridge.telegram && !bridge.remoteNode) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <div className="max-w-md rounded-3xl border border-dashed border-gray-300 dark:border-white/[0.08] px-8 py-10 text-center bg-white/60 dark:bg-white/[0.02]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Consola no disponible</h3>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
            Este panel necesita los bridges de Electron para automatizaciones, Telegram y equipos conectados.
          </p>
        </div>
      </div>
    );
  }

  const ACTION_TABS = [
    { id: 'triage' as const, label: 'Correos', icon: '✉' },
    { id: 'brief' as const, label: 'Agenda', icon: '📅' },
    { id: 'followup' as const, label: 'Seguimiento', icon: '↩' },
    { id: 'meeting' as const, label: 'Reunion', icon: '👥' },
    { id: 'drive' as const, label: 'Drive', icon: '📁' },
    { id: 'chat' as const, label: 'Chat', icon: '💬' },
    { id: 'desktop' as const, label: 'PC', icon: '🖥' },
    { id: 'custom' as const, label: 'Flujos', icon: '⚡' },
  ];

  const renderActionForm = () => {
    switch (activeAction) {
      case 'triage':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Ayuda con correos</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Revisa un correo importante y sugiere la mejor accion.</p>
            </div>
            <select className={inputClass} value={triagePreset} onChange={(e) => setTriagePreset(e.target.value as TriagePresetId)}>
              {TRIAGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{TRIAGE_PRESETS.find((p) => p.id === triagePreset)?.description}</p>
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
              <div className="mt-3 space-y-2">
                {triagePreset === 'custom' ? (
                  <input className={inputClass} value={triageQuery} onChange={(e) => setTriageQuery(e.target.value)} placeholder="from:cliente@empresa.com newer_than:7d" />
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-2 text-xs text-gray-500">Filtro: {effectiveTriageQuery}</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} type="number" min={1} max={10} value={triageMaxResults} onChange={(e) => setTriageMaxResults(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
                  <select className={inputClass} value={triageChatSpace} onChange={(e) => setTriageChatSpace(e.target.value)}>
                    <option value="">Sin Google Chat</option>
                    {spaces.map((s) => <option key={s.name} value={s.name}>{s.displayName || s.name}</option>)}
                  </select>
                </div>
              </div>
            </details>
            <button type="button" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-triage', async () => {
                const result = await executeAutomationTemplate({ templateId: 'gmail_triage', requestedBy: `app:${userId}`, input: { query: effectiveTriageQuery, maxResults: triageMaxResults, gchatSpace: triageChatSpace || undefined, removeFromInbox: true } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude revisar el correo.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-triage'}
            >{actionKey === 'run-triage' ? 'Preparando...' : 'Revisar correo importante'}</button>
          </div>
        );
      case 'brief':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Resumen de agenda</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Resume el dia, detecta riesgos y prepara una nota breve.</p>
            </div>
            <input className={inputClass} type="date" value={briefDate} onChange={(e) => setBriefDate(e.target.value)} />
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Compartir por Google Chat</summary>
              <div className="mt-3">
                <select className={inputClass} value={briefChatSpace} onChange={(e) => setBriefChatSpace(e.target.value)}>
                  <option value="">Sin Google Chat</option>
                  {spaces.map((s) => <option key={s.name} value={s.name}>{s.displayName || s.name}</option>)}
                </select>
              </div>
            </details>
            <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-brief', async () => {
                const result = await executeAutomationTemplate({ templateId: 'calendar_daily_brief', requestedBy: `app:${userId}`, input: { targetDate: briefDate || undefined, gchatSpace: briefChatSpace || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la agenda.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-brief'}
            >{actionKey === 'run-brief' ? 'Preparando...' : 'Preparar mi agenda'}</button>
          </div>
        );
      case 'followup':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Correo de seguimiento</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Redacta un seguimiento profesional listo para autorizacion.</p>
            </div>
            <input className={inputClass} value={followupTo} onChange={(e) => setFollowupTo(e.target.value)} placeholder="correo@empresa.com" />
            <input className={inputClass} value={followupTopic} onChange={(e) => setFollowupTopic(e.target.value)} placeholder="Tema o motivo" />
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Contexto adicional</summary>
              <div className="mt-3"><textarea className={textareaClass} value={followupContext} onChange={(e) => setFollowupContext(e.target.value)} placeholder="Ya hubo una llamada, falta confirmar propuesta..." /></div>
            </details>
            <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-followup', async () => {
                const result = await executeAutomationTemplate({ templateId: 'gmail_followup_draft', requestedBy: `app:${userId}`, input: { to: followupTo.trim(), topic: followupTopic.trim(), context: followupContext.trim() || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el seguimiento.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-followup' || !followupTo.trim() || !followupTopic.trim()}
            >{actionKey === 'run-followup' ? 'Preparando...' : 'Preparar seguimiento'}</button>
          </div>
        );
      case 'meeting':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Preparacion de reunion</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Prepara tu siguiente reunion del dia.</p>
            </div>
            <input className={inputClass} type="date" value={meetingPrepDate} onChange={(e) => setMeetingPrepDate(e.target.value)} />
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Compartir por Google Chat</summary>
              <div className="mt-3">
                <select className={inputClass} value={meetingPrepChatSpace} onChange={(e) => setMeetingPrepChatSpace(e.target.value)}>
                  <option value="">Sin Google Chat</option>
                  {spaces.map((s) => <option key={s.name} value={s.name}>{s.displayName || s.name}</option>)}
                </select>
              </div>
            </details>
            <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-meeting-prep', async () => {
                const result = await executeAutomationTemplate({ templateId: 'calendar_meeting_prep', requestedBy: `app:${userId}`, input: { targetDate: meetingPrepDate || undefined, gchatSpace: meetingPrepChatSpace || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la reunion.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-meeting-prep'}
            >{actionKey === 'run-meeting-prep' ? 'Preparando...' : 'Preparar reunion'}</button>
          </div>
        );
      case 'drive':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Espacio de proyecto en Drive</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Crea una estructura base de carpetas para un proyecto.</p>
            </div>
            <input className={inputClass} value={driveProjectName} onChange={(e) => setDriveProjectName(e.target.value)} placeholder="Nombre del proyecto o cliente" />
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
              <div className="mt-3 space-y-2">
                <input className={inputClass} value={driveParentFolderId} onChange={(e) => setDriveParentFolderId(e.target.value)} placeholder="Carpeta padre (opcional)" />
                <select className={inputClass} value={driveChatSpace} onChange={(e) => setDriveChatSpace(e.target.value)}>
                  <option value="">Sin aviso en Google Chat</option>
                  {spaces.map((s) => <option key={s.name} value={s.name}>{s.displayName || s.name}</option>)}
                </select>
              </div>
            </details>
            <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-drive-workspace', async () => {
                const result = await executeAutomationTemplate({ templateId: 'drive_project_workspace', requestedBy: `app:${userId}`, input: { projectName: driveProjectName.trim(), parentFolderId: driveParentFolderId.trim() || undefined, gchatSpace: driveChatSpace || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el espacio en Drive.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-drive-workspace' || !driveProjectName.trim()}
            >{actionKey === 'run-drive-workspace' ? 'Preparando...' : 'Crear espacio base'}</button>
          </div>
        );
      case 'chat':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Actualizacion ejecutiva en Chat</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Convierte una situacion en un mensaje listo para tu equipo.</p>
            </div>
            <select className={inputClass} value={executiveChatSpace} onChange={(e) => setExecutiveChatSpace(e.target.value)}>
              <option value="">Selecciona un espacio</option>
              {spaces.map((s) => <option key={s.name} value={s.name}>{s.displayName || s.name}</option>)}
            </select>
            <textarea className={textareaClass} value={executiveContext} onChange={(e) => setExecutiveContext(e.target.value)} placeholder="Avance del proyecto, riesgo detectado, decision requerida..." />
            <input className={inputClass} value={executiveTone} onChange={(e) => setExecutiveTone(e.target.value)} placeholder="Tono sugerido" />
            <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-executive-update', async () => {
                const result = await executeAutomationTemplate({ templateId: 'gchat_executive_update', requestedBy: `app:${userId}`, input: { spaceName: executiveChatSpace, context: executiveContext.trim(), tone: executiveTone.trim() || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la actualizacion.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-executive-update' || !executiveChatSpace || !executiveContext.trim()}
            >{actionKey === 'run-executive-update' ? 'Preparando...' : 'Preparar mensaje ejecutivo'}</button>
          </div>
        );
      case 'desktop':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Accion en mi computadora</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Prepara una accion operativa y espera tu autorizacion.</p>
            </div>
            <textarea className={textareaClass} value={desktopObjective} onChange={(e) => setDesktopObjective(e.target.value)} placeholder="Entra al portal, descarga el archivo mas reciente..." />
            <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select className={inputClass} value={desktopBackend} onChange={(e) => setDesktopBackend(e.target.value)}>
                  <option value="auto">Automatico</option>
                  <option value="browser">Navegador</option>
                  <option value="desktop">Escritorio</option>
                  <option value="uia">Windows UIA</option>
                </select>
                <input className={inputClass} value={desktopStartUrl} onChange={(e) => setDesktopStartUrl(e.target.value)} placeholder="URL inicial (opcional)" />
              </div>
            </details>
            <button type="button" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('run-desktop-action', async () => {
                const result = await executeAutomationTemplate({ templateId: 'desktop_action', requestedBy: `app:${userId}`, input: { objective: desktopObjective.trim(), backend: desktopBackend || undefined, startUrl: desktopStartUrl.trim() || undefined } });
                if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la accion.');
                await refreshOverview(false);
                setSelectedRunId(result.run.id);
                setNotice(`Caso creado: ${result.run.title}.`);
              })}
              disabled={actionKey === 'run-desktop-action' || !desktopObjective.trim()}
            >{actionKey === 'run-desktop-action' ? 'Preparando...' : 'Preparar accion'}</button>
          </div>
        );
      case 'custom':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Flujos personalizados</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Describe un proceso y SofLIA lo convierte en un flujo reusable.</p>
            </div>
            <div className="space-y-2">
              <input className={inputClass} value={customFlowName} onChange={(e) => setCustomFlowName(e.target.value)} placeholder="Nombre del flujo" />
              <textarea className={textareaClass} value={customFlowObjective} onChange={(e) => setCustomFlowObjective(e.target.value)} placeholder="Que debe lograr SofLIA y cuando pedir autorizacion." />
              <button type="button" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('create-custom-flow', async () => {
                  const result = await createCustomAutomationTemplate({ name: customFlowName.trim() || undefined, objective: customFlowObjective.trim(), requestedBy: `app:${userId}` });
                  if (!result.success || !result.template) throw new Error(result.error || 'No pude crear el flujo.');
                  setCustomFlowName(''); setCustomFlowObjective(''); setCustomFlowDetails('');
                  await refreshOverview(true);
                  setSelectedCustomTemplateId(result.template.id);
                  setNotice(`Flujo creado: ${result.template.name}.`);
                })}
                disabled={actionKey === 'create-custom-flow' || !customFlowObjective.trim()}
              >{actionKey === 'create-custom-flow' ? 'Diseñando...' : 'Diseñar flujo'}</button>
            </div>
            {customTemplates.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Mis flujos</p>
                {customTemplates.map((t) => (
                  <button key={t.id} type="button" onClick={() => setSelectedCustomTemplateId(t.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${selectedCustomTemplateId === t.id ? 'border-accent/25 bg-accent/8' : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/15'}`}>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomTemplate && (
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{selectedCustomTemplate.name}</p>
                {selectedCustomTemplate.guidance && <p className="text-[11px] text-gray-500 dark:text-gray-400">{selectedCustomTemplate.guidance}</p>}
                <textarea className={textareaClass} value={customFlowDetails} onChange={(e) => setCustomFlowDetails(e.target.value)} placeholder="Describe el caso actual para este flujo." />
                <button type="button" className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
                  onClick={() => void runAction('run-custom-flow', async () => {
                    const result = await executeAutomationTemplate({ templateId: selectedCustomTemplate.id, requestedBy: `app:${userId}`, input: { details: customFlowDetails.trim() || undefined } });
                    if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar este flujo.');
                    await refreshOverview(false);
                    setSelectedRunId(result.run.id);
                    setNotice(`Caso creado desde ${selectedCustomTemplate.name}.`);
                  })}
                  disabled={actionKey === 'run-custom-flow'}
                >{actionKey === 'run-custom-flow' ? 'Preparando...' : 'Ejecutar flujo'}</button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Asistente Ejecutivo</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Correos, agenda y autorizaciones en una sola vista</p>
        </div>
        <button type="button" className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:rotate-180 duration-500"
          onClick={() => void runAction('refresh-overview', async () => { await refreshOverview(true); setNotice('Consola sincronizada.'); })} disabled={actionKey === 'refresh-overview'} title="Actualizar">
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${actionKey === 'refresh-overview' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      {/* Alerts */}
      {(error || notice) && (
        <div className="shrink-0 px-6 pb-2 space-y-2">
          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{error}</div>}
          {notice && <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-xs text-accent">{notice}</div>}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* ── Action Builder ── */}
        <section className="px-6 pt-2 pb-5">
          {/* Tabs */}
          <div className="overflow-x-auto no-scrollbar mb-4">
            <div className="flex gap-1.5 min-w-max">
              {ACTION_TABS.map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveAction(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                    activeAction === tab.id
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04] border border-transparent'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active form */}
          <div className="max-w-xl">
            <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
              {renderActionForm()}
            </div>
          </div>

          {/* Collapsible extras */}
          <div className="max-w-xl mt-4 space-y-3">
            <details className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
              <summary className="cursor-pointer list-none text-xs font-semibold text-gray-600 dark:text-gray-400">Atajos de WhatsApp</summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['/correo', '/agenda', '/seguimiento', '/prepreunion', '/driveproyecto', '/chatdirectivo', '/computadora', '/crearflujo', '/flujos', '/pendientes', '/aprobar', '/rechazar'].map((cmd) => (
                  <code key={cmd} className="px-2 py-1 rounded-md bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-[10px] font-mono text-gray-600 dark:text-gray-400">{cmd}</code>
                ))}
              </div>
            </details>

            {bridge.telegram && (
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-4 py-3">
                <summary className="cursor-pointer list-none text-xs font-semibold text-gray-600 dark:text-gray-400">Telegram (avanzado)</summary>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} />
                    Habilitar canal
                  </label>
                  <input className={inputClass} type="password" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} placeholder="Bot token (opcional)" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} type="number" min={2000} step={1000} value={telegramPollInterval} onChange={(e) => setTelegramPollInterval(Math.max(2000, Number(e.target.value) || 2000))} />
                    <input className={inputClass} value={telegramStatus?.bot?.username ? `@${telegramStatus.bot.username}` : ''} placeholder="Bot actual" disabled />
                  </div>
                  <textarea className={textareaClass} value={telegramAllowedChats} onChange={(e) => setTelegramAllowedChats(e.target.value)} placeholder="Chat IDs separados por coma" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2 text-xs font-semibold transition disabled:opacity-40"
                      onClick={() => void runAction('save-telegram', async () => {
                        const result = await updateTelegramConfig({ enabled: telegramEnabled, bot_token: telegramToken.trim() || undefined, poll_interval_ms: telegramPollInterval, allowed_chat_ids: telegramAllowedChats.split(',').map((i) => i.trim()).filter(Boolean) });
                        if (!result.success) throw new Error(result.error || 'No pude guardar Telegram.');
                        setTelegramStatus(result); setTelegramToken(''); await refreshOverview(true); setNotice('Telegram actualizado.');
                      })} disabled={actionKey === 'save-telegram'}>{actionKey === 'save-telegram' ? 'Guardando...' : 'Guardar'}</button>
                    <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                      onClick={() => void runAction('test-telegram', async () => {
                        const result = await testTelegramConnection();
                        if (!result.success) throw new Error(result.error || 'No pude validar el bot.');
                        await refreshOverview(true); setNotice(`Bot conectado: ${result.bot?.username || 'sin nombre'}.`);
                      })} disabled={actionKey === 'test-telegram'}>{actionKey === 'test-telegram' ? 'Probando...' : 'Probar bot'}</button>
                  </div>
                  {recentChats.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Actividad reciente</p>
                      {recentChats.slice(0, 3).map((chat) => (
                        <div key={chat.chatId} className="rounded-lg border border-gray-200 dark:border-white/[0.06] px-2.5 py-2">
                          <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate">{chat.title}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-500 truncate">{chat.lastMessagePreview}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* ── Cases ── */}
        <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Casos</p>
            {pendingRuns.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                {pendingRuns.length} pendiente{pendingRuns.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/[0.06] px-4 py-10 text-center text-xs text-gray-500 dark:text-gray-500">
              Sin casos aun. Ejecuta una accion arriba para crear uno.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Case cards - horizontal scroll on small, grid on large */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {runs.map((run) => (
                  <button key={run.id} type="button" onClick={() => setSelectedRunId(selectedRunId === run.id ? null : run.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      selectedRunId === run.id
                        ? 'border-accent/30 bg-accent/8 shadow-md ring-1 ring-accent/10'
                        : 'border-gray-200 dark:border-white/[0.06] hover:border-accent/20 bg-white dark:bg-white/[0.02]'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">{run.title}</p>
                      <StatusBadge value={run.status} styles={RUN_STATUS_STYLES} />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">
                      {prettyTemplateId(run.templateId)} · {formatDateTime(run.updatedAt)}
                    </p>
                  </button>
                ))}
              </div>

              {/* Inline case detail */}
              {selectedRun && (
                <div className="mt-4 space-y-4">
                  {/* Case header card */}
                  <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{selectedRun.title}</p>
                        {selectedRun.summary && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedRun.summary}</p>}
                      </div>
                      <StatusBadge value={selectedRun.status} styles={RUN_STATUS_STYLES} />
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500 mb-4">
                      <span>Folio: <span className="font-mono">{selectedRun.id.slice(0, 12)}</span></span>
                      <span>{formatDateTime(selectedRun.createdAt)}</span>
                      {selectedRun.requestedBy && <span>Por: {selectedRun.requestedBy}</span>}
                    </div>

                    {/* Preview fields */}
                    {Object.keys(selectedRun.preview || {}).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Object.entries(selectedRun.preview || {}).map(([key, value]) => (
                          <div key={key} className="rounded-lg border border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-black/10 px-3 py-2">
                            <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-500 truncate">{prettyFieldLabel(key)}</p>
                            <p className="mt-1 text-[12px] text-gray-800 dark:text-gray-200 line-clamp-3 break-words">{previewValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Approval zone */}
                    {selectedRun.status === 'needs_approval' && (
                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 space-y-3">
                        <p className="text-xs text-amber-700 dark:text-amber-200">Este caso espera tu autorizacion antes de ejecutar acciones.</p>
                        <textarea className={textareaClass} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario opcional" />
                        <div className="flex gap-2">
                          <button type="button" className="flex-1 rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-sm font-semibold transition disabled:opacity-40"
                            onClick={() => void runAction('approve-workflow', async () => {
                              const result = await approveAutomationRun({ runId: selectedRun.id, decidedBy: userId, comment: comment.trim() || null });
                              if (!result.success || !result.run) throw new Error(result.error || 'No pude autorizar.');
                              await refreshOverview(true); setComment(''); setNotice(`Autorizado: ${result.run.title}.`);
                            })} disabled={actionKey === 'approve-workflow'}>{actionKey === 'approve-workflow' ? 'Autorizando...' : 'Autorizar'}</button>
                          <button type="button" className="flex-1 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 py-2.5 text-sm font-semibold transition disabled:opacity-40"
                            onClick={() => void runAction('reject-workflow', async () => {
                              const result = await rejectAutomationRun({ runId: selectedRun.id, decidedBy: userId, comment: comment.trim() || null });
                              if (!result.success || !result.run) throw new Error(result.error || 'No pude detener.');
                              await refreshOverview(true); setComment(''); setNotice(`Detenido: ${result.run.title}.`);
                            })} disabled={actionKey === 'reject-workflow'}>{actionKey === 'reject-workflow' ? 'Deteniendo...' : 'No autorizar'}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions proposed */}
                  {selectedRun.actions.length > 0 && (
                    <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
                      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Acciones propuestas</p>
                      <div className="space-y-3">
                        {selectedRun.actions.map((action) => (
                          <div key={action.id} className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white">{action.title}</p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-0.5">{prettyActionKind(action.kind)}</p>
                              </div>
                              <StatusBadge value={action.status} styles={ACTION_STATUS_STYLES} />
                            </div>
                            {Object.keys(action.payload || {}).length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                {Object.entries(action.payload || {}).map(([key, value]) => (
                                  <div key={key} className="rounded-lg bg-white dark:bg-black/10 border border-gray-100 dark:border-white/[0.04] px-2.5 py-1.5">
                                    <p className="text-[9px] uppercase tracking-wider text-gray-500 truncate">{prettyFieldLabel(key)}</p>
                                    <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-2 break-words mt-0.5">{previewValue(value)}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remote nodes */}
                  {bridge.remoteNode && (
                    <details className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
                      <summary className="cursor-pointer list-none flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Equipos conectados</p>
                        <StatusBadge value={hostStatus?.running ? 'completed' : 'failed'} styles={RUN_STATUS_STYLES} />
                      </summary>
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <input className={inputClass} value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="Nombre" />
                          <input className={inputClass} value={nodeBaseUrl} onChange={(e) => setNodeBaseUrl(e.target.value)} placeholder="Base URL" />
                          <input className={inputClass} value={nodeToken} onChange={(e) => setNodeToken(e.target.value)} placeholder="Token" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2 px-4 text-xs font-semibold transition disabled:opacity-40"
                            onClick={() => void runAction('register-remote-node', async () => {
                              const result = await registerRemoteNode({ name: nodeName.trim(), base_url: nodeBaseUrl.trim(), token: nodeToken.trim() });
                              if (!result.success) throw new Error(result.error || 'No pude registrar.');
                              setNodeName(''); setNodeBaseUrl('http://127.0.0.1:47825'); setNodeToken('');
                              await refreshOverview(true); setNotice(`Nodo registrado: ${result.node?.name || 'nuevo'}.`);
                            })} disabled={actionKey === 'register-remote-node' || !nodeName.trim() || !nodeBaseUrl.trim() || !nodeToken.trim()}
                          >{actionKey === 'register-remote-node' ? 'Registrando...' : 'Registrar'}</button>
                          <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2 px-4 text-xs font-semibold transition disabled:opacity-40"
                            onClick={() => void runAction('toggle-remote-host', async () => {
                              if (!hostStatus) return;
                              const result = await updateRemoteNodeHostConfig({ enabled: !hostStatus.enabled });
                              setHostStatus(result); await refreshOverview(true); setNotice(result.enabled ? 'Host habilitado.' : 'Host deshabilitado.');
                            })} disabled={actionKey === 'toggle-remote-host' || !hostStatus}
                          >{actionKey === 'toggle-remote-host' ? 'Aplicando...' : hostStatus?.enabled ? 'Desactivar' : 'Activar'}</button>
                          <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 px-4 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                            onClick={() => void runAction('rotate-remote-token', async () => {
                              const result = await updateRemoteNodeHostConfig({ rotate_token: true });
                              setHostStatus(result); await refreshOverview(true); setNotice('Token rotado.');
                            })} disabled={actionKey === 'rotate-remote-token'}
                          >{actionKey === 'rotate-remote-token' ? 'Rotando...' : 'Rotar token'}</button>
                        </div>
                        {nodes.map((node) => (
                          <div key={node.id} className="rounded-xl border border-gray-200 dark:border-white/[0.06] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{node.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{node.baseUrl}</p>
                              </div>
                              <p className={`text-[10px] font-medium ${node.lastError ? 'text-red-500' : 'text-emerald-500'}`}>{node.lastError ? 'Error' : 'OK'}</p>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button type="button" className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.06] py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                                onClick={() => void runAction(`test-node-${node.id}`, async () => {
                                  const result = await testRemoteNode(node.id);
                                  if (!result.success) throw new Error(result.error || 'Fallo.'); await refreshOverview(true); setNotice(`Nodo validado.`);
                                })} disabled={actionKey === `test-node-${node.id}`}>{actionKey === `test-node-${node.id}` ? '...' : 'Probar'}</button>
                              <button type="button" className="flex-1 rounded-lg border border-accent/20 bg-accent/10 py-1.5 text-[11px] font-semibold text-accent transition disabled:opacity-40"
                                onClick={() => void runAction(`screenshot-node-${node.id}`, async () => {
                                  const result = await takeRemoteNodeScreenshot(node.id);
                                  if (!result.success || !result.image) throw new Error(result.error || 'Fallo.');
                                  setRemoteImage({ nodeId: node.id, image: result.image, capturedAt: new Date().toISOString() }); setNotice(`Captura tomada.`);
                                })} disabled={actionKey === `screenshot-node-${node.id}`}>{actionKey === `screenshot-node-${node.id}` ? '...' : 'Captura'}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Remote screenshot */}
                  {bridge.remoteNode && remoteImage && (
                    <div className="bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-lg">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Vista remota — {remoteImage.nodeId}</p>
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.06]">
                        <img src={remoteImage.image} alt={`Captura ${remoteImage.nodeId}`} className="w-full h-auto object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
