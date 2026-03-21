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

interface CalendarConnection {
  provider: string;
  email?: string;
  isActive?: boolean;
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
  const [workspaceLabel, setWorkspaceLabel] = useState('Sin validar');
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

  const loadWorkspaceConnections = useCallback(async () => {
    const calendarApi = (window as { calendar?: { getConnections?: () => Promise<CalendarConnection[]> } }).calendar;
    if (!calendarApi?.getConnections) {
      setWorkspaceLabel('Bridge no disponible');
      return;
    }
    try {
      const connections = await calendarApi.getConnections();
      const googleConnection = Array.isArray(connections)
        ? connections.find((item) => item.provider === 'google' && item.isActive)
        : null;
      setWorkspaceLabel(googleConnection?.email || 'Google no conectado');
    } catch (currentError: unknown) {
      setWorkspaceLabel(getErrorMessage(currentError) || 'No disponible');
    }
  }, []);

  const refreshOverview = useCallback(async (preserveSelection = true) => {
    const tasks: Array<Promise<void>> = [loadWorkspaceConnections()];

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
  }, [bridge.automation, bridge.gchat, bridge.remoteNode, bridge.telegram, loadWorkspaceConnections, telegramHydrated]);

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

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-white/[0.04]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">Asistente Ejecutivo</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-500">Ordena correos, resume tu agenda y concentra las autorizaciones en una sola vista.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-gray-700 dark:text-gray-200 hover:border-accent/25 hover:text-accent transition"
            onClick={() => void runAction('refresh-overview', async () => {
              await refreshOverview(true);
              setNotice('Consola sincronizada.');
            })}
            disabled={actionKey === 'refresh-overview'}
          >
            {actionKey === 'refresh-overview' ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>
      <div className="shrink-0 px-6 pt-4 grid grid-cols-4 gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-500">Casos</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight text-gray-900 dark:text-white">{runs.length}</p>
        </div>
        <div className="rounded-2xl border border-accent/25 bg-accent/8 px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-500">Por Autorizar</p>
          <p className="mt-2 text-[18px] font-semibold tracking-tight text-accent">
            {pendingRuns.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-500">Atajos WA</p>
          <p className="mt-2 text-[14px] font-semibold tracking-tight text-gray-900 dark:text-white">
            {bridge.automation ? 'Disponibles' : 'No disponibles'}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-500">Google</p>
          <p className="mt-2 text-[14px] font-semibold tracking-tight text-gray-900 dark:text-white truncate">{workspaceLabel}</p>
        </div>
      </div>

      <div className="shrink-0 px-6 pt-3 space-y-2">
        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-[12px] text-accent">{notice}</div> : null}
      </div>

      <div className="flex-1 overflow-hidden flex pt-4">
        <aside className="w-[360px] shrink-0 border-r border-gray-200 dark:border-white/[0.04] px-5 pb-5 overflow-y-auto no-scrollbar space-y-5">
          <section className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4 space-y-4">
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Acciones listas para usar</p>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">SofLIA prepara propuestas y solo te pide autorización cuando hace falta.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Ayuda con correos</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Revisa un correo importante, sugiere la mejor siguiente accion y la deja lista para decidir.
                </p>
              </div>
              <select className={inputClass} value={triagePreset} onChange={(event) => setTriagePreset(event.target.value as TriagePresetId)}>
                {TRIAGE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 dark:text-gray-500">
                {TRIAGE_PRESETS.find((preset) => preset.id === triagePreset)?.description}
              </p>
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
                <div className="mt-3 space-y-2">
                  {triagePreset === 'custom' ? (
                    <input
                      className={inputClass}
                      value={triageQuery}
                      onChange={(event) => setTriageQuery(event.target.value)}
                      placeholder="Ejemplo: from:cliente@empresa.com newer_than:7d"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-2 text-[12px] text-gray-500 dark:text-gray-500">
                      Filtro usado: {effectiveTriageQuery}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} type="number" min={1} max={10} value={triageMaxResults} onChange={(event) => setTriageMaxResults(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
                    <select className={inputClass} value={triageChatSpace} onChange={(event) => setTriageChatSpace(event.target.value)}>
                      <option value="">Sin Google Chat</option>
                      {spaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
                    </select>
                  </div>
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-triage', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'gmail_triage',
                    requestedBy: `app:${userId}`,
                    input: {
                      query: effectiveTriageQuery,
                      maxResults: triageMaxResults,
                      gchatSpace: triageChatSpace || undefined,
                      removeFromInbox: true,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude revisar el correo.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-triage'}
              >
                {actionKey === 'run-triage' ? 'Preparando...' : 'Revisar correo importante'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Resumen de agenda</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Resume el dia, detecta riesgos y prepara una nota breve para compartir con tu equipo.
                </p>
              </div>
              <input className={inputClass} type="date" value={briefDate} onChange={(event) => setBriefDate(event.target.value)} />
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
                <div className="mt-3">
                  <select className={inputClass} value={briefChatSpace} onChange={(event) => setBriefChatSpace(event.target.value)}>
                    <option value="">Sin Google Chat</option>
                    {spaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
                  </select>
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-brief', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'calendar_daily_brief',
                    requestedBy: `app:${userId}`,
                    input: { targetDate: briefDate || undefined, gchatSpace: briefChatSpace || undefined },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la agenda.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-brief'}
              >
                {actionKey === 'run-brief' ? 'Preparando...' : 'Preparar mi agenda'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Correo de seguimiento</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Redacta un seguimiento profesional y lo deja listo para autorizacion.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  value={followupTo}
                  onChange={(event) => setFollowupTo(event.target.value)}
                  placeholder="correo@empresa.com"
                />
                <input
                  className={inputClass}
                  value={followupTopic}
                  onChange={(event) => setFollowupTopic(event.target.value)}
                  placeholder="Tema o motivo"
                />
              </div>
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Contexto adicional</summary>
                <div className="mt-3">
                  <textarea
                    className={textareaClass}
                    value={followupContext}
                    onChange={(event) => setFollowupContext(event.target.value)}
                    placeholder="Ejemplo: ya hubo una llamada, falta confirmar propuesta y siguiente paso."
                  />
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-followup', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'gmail_followup_draft',
                    requestedBy: `app:${userId}`,
                    input: {
                      to: followupTo.trim(),
                      topic: followupTopic.trim(),
                      context: followupContext.trim() || undefined,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el seguimiento.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-followup' || !followupTo.trim() || !followupTopic.trim()}
              >
                {actionKey === 'run-followup' ? 'Preparando...' : 'Preparar seguimiento'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Preparacion de reunion</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Prepara tu siguiente reunion del dia y, si quieres, deja listo el mensaje para tu equipo.
                </p>
              </div>
              <input className={inputClass} type="date" value={meetingPrepDate} onChange={(event) => setMeetingPrepDate(event.target.value)} />
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Compartir por Google Chat</summary>
                <div className="mt-3">
                  <select className={inputClass} value={meetingPrepChatSpace} onChange={(event) => setMeetingPrepChatSpace(event.target.value)}>
                    <option value="">Sin Google Chat</option>
                    {spaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
                  </select>
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-meeting-prep', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'calendar_meeting_prep',
                    requestedBy: `app:${userId}`,
                    input: {
                      targetDate: meetingPrepDate || undefined,
                      gchatSpace: meetingPrepChatSpace || undefined,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la reunion.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-meeting-prep'}
              >
                {actionKey === 'run-meeting-prep' ? 'Preparando...' : 'Preparar reunion'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Espacio de proyecto en Drive</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Crea una estructura base de carpetas para un proyecto, cliente o iniciativa.
                </p>
              </div>
              <input
                className={inputClass}
                value={driveProjectName}
                onChange={(event) => setDriveProjectName(event.target.value)}
                placeholder="Nombre del proyecto o cliente"
              />
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
                <div className="mt-3 space-y-2">
                  <input
                    className={inputClass}
                    value={driveParentFolderId}
                    onChange={(event) => setDriveParentFolderId(event.target.value)}
                    placeholder="Carpeta padre en Drive (opcional)"
                  />
                  <select className={inputClass} value={driveChatSpace} onChange={(event) => setDriveChatSpace(event.target.value)}>
                    <option value="">Sin aviso en Google Chat</option>
                    {spaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
                  </select>
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-drive-workspace', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'drive_project_workspace',
                    requestedBy: `app:${userId}`,
                    input: {
                      projectName: driveProjectName.trim(),
                      parentFolderId: driveParentFolderId.trim() || undefined,
                      gchatSpace: driveChatSpace || undefined,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el espacio en Drive.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-drive-workspace' || !driveProjectName.trim()}
              >
                {actionKey === 'run-drive-workspace' ? 'Preparando...' : 'Crear espacio base'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Actualizacion ejecutiva en Chat</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  Convierte una situacion en un mensaje listo para compartir con direccion o con tu equipo.
                </p>
              </div>
              <select className={inputClass} value={executiveChatSpace} onChange={(event) => setExecutiveChatSpace(event.target.value)}>
                <option value="">Selecciona un espacio</option>
                {spaces.map((space) => <option key={space.name} value={space.name}>{space.displayName || space.name}</option>)}
              </select>
              <textarea
                className={textareaClass}
                value={executiveContext}
                onChange={(event) => setExecutiveContext(event.target.value)}
                placeholder="Ejemplo: avance del proyecto, riesgo detectado, decision requerida o estatus para direccion."
              />
              <input
                className={inputClass}
                value={executiveTone}
                onChange={(event) => setExecutiveTone(event.target.value)}
                placeholder="Tono sugerido"
              />
              <button
                type="button"
                className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-executive-update', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'gchat_executive_update',
                    requestedBy: `app:${userId}`,
                    input: {
                      spaceName: executiveChatSpace,
                      context: executiveContext.trim(),
                      tone: executiveTone.trim() || undefined,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la actualizacion.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-executive-update' || !executiveChatSpace || !executiveContext.trim()}
              >
                {actionKey === 'run-executive-update' ? 'Preparando...' : 'Preparar mensaje ejecutivo'}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Accion en mi computadora</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                  SofLIA puede preparar una accion operativa dentro de tu computadora y esperar tu autorizacion.
                </p>
              </div>
              <textarea
                className={textareaClass}
                value={desktopObjective}
                onChange={(event) => setDesktopObjective(event.target.value)}
                placeholder="Ejemplo: entra al portal, descarga el archivo mas reciente y guardalo en la carpeta Finanzas."
              />
              <details className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select className={inputClass} value={desktopBackend} onChange={(event) => setDesktopBackend(event.target.value)}>
                    <option value="auto">Automatico</option>
                    <option value="browser">Navegador</option>
                    <option value="desktop">Escritorio</option>
                    <option value="uia">Windows UIA</option>
                  </select>
                  <input
                    className={inputClass}
                    value={desktopStartUrl}
                    onChange={(event) => setDesktopStartUrl(event.target.value)}
                    placeholder="URL inicial opcional"
                  />
                </div>
              </details>
              <button
                type="button"
                className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                onClick={() => void runAction('run-desktop-action', async () => {
                  const result = await executeAutomationTemplate({
                    templateId: 'desktop_action',
                    requestedBy: `app:${userId}`,
                    input: {
                      objective: desktopObjective.trim(),
                      backend: desktopBackend || undefined,
                      startUrl: desktopStartUrl.trim() || undefined,
                    },
                  });
                  if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la accion en tu computadora.');
                  await refreshOverview(false);
                  setSelectedRunId(result.run.id);
                  setNotice(`Caso creado: ${result.run.title}.`);
                })}
                disabled={actionKey === 'run-desktop-action' || !desktopObjective.trim()}
              >
                {actionKey === 'run-desktop-action' ? 'Preparando...' : 'Preparar accion en mi computadora'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4 space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Crea tu propio flujo</p>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                Describe el proceso que quieres automatizar y SofLIA lo convierte en un flujo reusable.
              </p>
            </div>
            <input
              className={inputClass}
              value={customFlowName}
              onChange={(event) => setCustomFlowName(event.target.value)}
              placeholder="Nombre del flujo, por ejemplo: Seguimiento a prospectos"
            />
            <textarea
              className={textareaClass}
              value={customFlowObjective}
              onChange={(event) => setCustomFlowObjective(event.target.value)}
              placeholder="Explica que debe lograr SofLIA, en que sistema o entorno trabaja y cuando debe pedir autorizacion."
            />
            <button
              type="button"
              className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
              onClick={() => void runAction('create-custom-flow', async () => {
                const result = await createCustomAutomationTemplate({
                  name: customFlowName.trim() || undefined,
                  objective: customFlowObjective.trim(),
                  requestedBy: `app:${userId}`,
                });
                if (!result.success || !result.template) throw new Error(result.error || 'No pude crear el flujo.');
                setCustomFlowName('');
                setCustomFlowObjective('');
                setCustomFlowDetails('');
                await refreshOverview(true);
                setSelectedCustomTemplateId(result.template.id);
                setNotice(`Flujo creado: ${result.template.name}.`);
              })}
              disabled={actionKey === 'create-custom-flow' || !customFlowObjective.trim()}
            >
              {actionKey === 'create-custom-flow' ? 'Diseñando...' : 'Diseñar flujo con SofLIA'}
            </button>

            <div className="space-y-2 pt-1">
              <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">Mis flujos</p>
              {customTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-4 py-5 text-center text-[12px] text-gray-500 dark:text-gray-500">
                  Aun no has creado flujos propios.
                </div>
              ) : (
                <div className="space-y-2">
                  {customTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedCustomTemplateId(template.id)}
                      className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                        selectedCustomTemplateId === template.id
                          ? 'border-accent/25 bg-accent/8'
                          : 'border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] hover:border-accent/15'
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{template.name}</p>
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500 line-clamp-2">{template.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomTemplate ? (
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-gray-50/70 dark:bg-black/10 p-3 space-y-3">
                <div>
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{selectedCustomTemplate.name}</p>
                  <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">{selectedCustomTemplate.description}</p>
                </div>
                {selectedCustomTemplate.guidance ? (
                  <div className="rounded-xl border border-gray-200 dark:border-white/[0.05] px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300">
                    {selectedCustomTemplate.guidance}
                  </div>
                ) : null}
                {selectedCustomTemplate.inputHints?.length ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-2 text-[12px] text-gray-600 dark:text-gray-300">
                    {selectedCustomTemplate.inputHints.join(' | ')}
                  </div>
                ) : null}
                <textarea
                  className={textareaClass}
                  value={customFlowDetails}
                  onChange={(event) => setCustomFlowDetails(event.target.value)}
                  placeholder="Describe el caso actual que quieres que este flujo atienda."
                />
                <button
                  type="button"
                  className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                  onClick={() => void runAction('run-custom-flow', async () => {
                    const result = await executeAutomationTemplate({
                      templateId: selectedCustomTemplate.id,
                      requestedBy: `app:${userId}`,
                      input: {
                        details: customFlowDetails.trim() || undefined,
                      },
                    });
                    if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar este flujo.');
                    await refreshOverview(false);
                    setSelectedRunId(result.run.id);
                    setNotice(`Caso creado desde ${selectedCustomTemplate.name}.`);
                  })}
                  disabled={actionKey === 'run-custom-flow'}
                >
                  {actionKey === 'run-custom-flow' ? 'Preparando...' : 'Ejecutar este flujo'}
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4 space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Tambien desde WhatsApp</p>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">
                Estos mensajes ya pueden crear casos y autorizar decisiones sin abrir configuraciones.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-3 text-[12px] text-gray-700 dark:text-gray-300">
              <p><span className="font-mono text-[11px]">/correo</span> revisa un correo importante.</p>
              <p><span className="font-mono text-[11px]">/correo hoy</span> prioriza correos nuevos de hoy.</p>
              <p><span className="font-mono text-[11px]">/agenda</span> prepara el resumen del dia.</p>
              <p><span className="font-mono text-[11px]">/seguimiento correo@empresa.com | tema | contexto</span> deja listo un seguimiento.</p>
              <p><span className="font-mono text-[11px]">/prepreunion 2026-03-22</span> prepara tu siguiente reunion.</p>
              <p><span className="font-mono text-[11px]">/driveproyecto Nombre | carpetaPadre</span> crea un espacio base en Drive.</p>
              <p><span className="font-mono text-[11px]">/chatdirectivo SPACE | contexto</span> prepara un mensaje ejecutivo.</p>
              <p><span className="font-mono text-[11px]">/computadora objetivo</span> prepara una accion en tu computadora.</p>
              <p><span className="font-mono text-[11px]">/crearflujo Nombre | Objetivo</span> crea un flujo propio.</p>
              <p><span className="font-mono text-[11px]">/flujos</span> lista tus flujos personalizados.</p>
              <p><span className="font-mono text-[11px]">/usarflujo ID | detalle</span> ejecuta un flujo propio.</p>
              <p><span className="font-mono text-[11px]">/pendientes</span> lista lo que espera tu autorizacion.</p>
              <p><span className="font-mono text-[11px]">/aprobar FOLIO</span> autoriza un caso.</p>
              <p><span className="font-mono text-[11px]">/rechazar FOLIO</span> detiene un caso.</p>
            </div>
          </section>

          {bridge.telegram ? (
            <details className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
              <summary className="cursor-pointer list-none">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Avisos por Telegram y ajustes avanzados</p>
                <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-500">Opcional. Recomendado solo si tambien quieres operar desde un bot.</p>
              </summary>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={telegramEnabled} onChange={(event) => setTelegramEnabled(event.target.checked)} />
                  Habilitar canal
                </label>
                <input className={inputClass} type="password" value={telegramToken} onChange={(event) => setTelegramToken(event.target.value)} placeholder="Nuevo bot token (opcional)" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} type="number" min={2000} step={1000} value={telegramPollInterval} onChange={(event) => setTelegramPollInterval(Math.max(2000, Number(event.target.value) || 2000))} />
                  <input className={inputClass} value={telegramStatus?.bot?.username ? `@${telegramStatus.bot.username}` : ''} placeholder="Bot actual" disabled />
                </div>
                <textarea className={textareaClass} value={telegramAllowedChats} onChange={(event) => setTelegramAllowedChats(event.target.value)} placeholder="Chat IDs separados por coma" />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                    onClick={() => void runAction('save-telegram', async () => {
                      const result = await updateTelegramConfig({
                        enabled: telegramEnabled,
                        bot_token: telegramToken.trim() || undefined,
                        poll_interval_ms: telegramPollInterval,
                        allowed_chat_ids: telegramAllowedChats.split(',').map((item) => item.trim()).filter(Boolean),
                      });
                      if (!result.success) throw new Error(result.error || 'No pude guardar Telegram.');
                      setTelegramStatus(result);
                      setTelegramToken('');
                      await refreshOverview(true);
                      setNotice('Configuracion de Telegram actualizada.');
                    })}
                    disabled={actionKey === 'save-telegram'}
                  >
                    {actionKey === 'save-telegram' ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2.5 text-[13px] font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                    onClick={() => void runAction('test-telegram', async () => {
                      const result = await testTelegramConnection();
                      if (!result.success) throw new Error(result.error || 'No pude validar el bot.');
                      await refreshOverview(true);
                      setNotice(`Bot conectado: ${result.bot?.username || result.bot?.first_name || 'sin nombre'}.`);
                    })}
                    disabled={actionKey === 'test-telegram'}
                  >
                    {actionKey === 'test-telegram' ? 'Probando...' : 'Probar bot'}
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">Actividad reciente</p>
                  {recentChats.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-4 py-6 text-center text-[12px] text-gray-500 dark:text-gray-500">
                      Sin actividad reciente.
                    </div>
                  ) : recentChats.slice(0, 4).map((chat) => (
                    <div key={chat.chatId} className="rounded-2xl border border-gray-200 dark:border-white/[0.05] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{chat.title}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">{chat.username ? `@${chat.username}` : chat.chatId}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-600">{chat.type}</span>
                      </div>
                      <p className="mt-2 text-[12px] text-gray-700 dark:text-gray-300 line-clamp-2">{chat.lastMessagePreview}</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </aside>

        <section className="w-[310px] shrink-0 border-r border-gray-200 dark:border-white/[0.04] px-4 pb-5 overflow-y-auto no-scrollbar">
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-3">Casos</p>
          <div className="space-y-2">
            {runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-4 py-8 text-center text-[12px] text-gray-500 dark:text-gray-500">
                Todavia no hay casos preparados.
              </div>
            ) : runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                  selectedRunId === run.id
                    ? 'border-accent/25 bg-accent/8'
                    : 'border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] hover:border-accent/15'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{run.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1 truncate">{run.summary}</p>
                  </div>
                  <StatusBadge value={run.status} styles={RUN_STATUS_STYLES} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600">
                  <span>{prettyTemplateId(run.templateId)}</span>
                  <span>{formatDateTime(run.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex-1 overflow-y-auto no-scrollbar px-5 pb-5 space-y-4">
          {selectedRun ? (
            <>
              <div className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">{selectedRun.title}</p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-500 mt-1">{selectedRun.summary}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-gray-600 dark:text-gray-400">
                      <div>Folio: <span className="font-mono text-[11px]">{selectedRun.id}</span></div>
                      <div>Solicitado por: {selectedRun.requestedBy || 'manual'}</div>
                      <div>Creado: {formatDateTime(selectedRun.createdAt)}</div>
                      <div>Actualizado: {formatDateTime(selectedRun.updatedAt)}</div>
                    </div>
                  </div>
                  <StatusBadge value={selectedRun.status} styles={RUN_STATUS_STYLES} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Object.entries(selectedRun.preview || {}).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-gray-200 dark:border-white/[0.05] px-3 py-2 bg-gray-50/70 dark:bg-black/10">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-500">{prettyFieldLabel(key)}</p>
                      <p className="mt-2 text-[12px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{previewValue(value)}</p>
                    </div>
                  ))}
                </div>

                {selectedRun.status === 'needs_approval' ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 space-y-3">
                    <p className="text-[12px] text-amber-700 dark:text-amber-200">
                      Este caso espera tu autorizacion antes de ejecutar acciones en Google Workspace o en tu computadora.
                    </p>
                    <textarea className={textareaClass} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comentario opcional para la decision" />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                        onClick={() => void runAction('approve-workflow', async () => {
                          const result = await approveAutomationRun({ runId: selectedRun.id, decidedBy: userId, comment: comment.trim() || null });
                          if (!result.success || !result.run) throw new Error(result.error || 'No pude autorizar el caso.');
                          await refreshOverview(true);
                          setComment('');
                          setNotice(`Caso autorizado: ${result.run.title}.`);
                        })}
                        disabled={actionKey === 'approve-workflow'}
                      >
                        {actionKey === 'approve-workflow' ? 'Autorizando...' : 'Autorizar'}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/12 text-red-600 dark:text-red-300 py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                        onClick={() => void runAction('reject-workflow', async () => {
                          const result = await rejectAutomationRun({ runId: selectedRun.id, decidedBy: userId, comment: comment.trim() || null });
                          if (!result.success || !result.run) throw new Error(result.error || 'No pude detener el caso.');
                          await refreshOverview(true);
                          setComment('');
                          setNotice(`Caso detenido: ${result.run.title}.`);
                        })}
                        disabled={actionKey === 'reject-workflow'}
                      >
                        {actionKey === 'reject-workflow' ? 'Deteniendo...' : 'No autorizar'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-3">Acciones propuestas</p>
                  <div className="space-y-3">
                    {selectedRun.actions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-4 py-6 text-center text-[12px] text-gray-500 dark:text-gray-500">
                        Este caso no genero acciones ejecutables.
                      </div>
                    ) : selectedRun.actions.map((action) => (
                      <div key={action.id} className="rounded-2xl border border-gray-200 dark:border-white/[0.05] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{action.title}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-600">{prettyActionKind(action.kind)}</p>
                          </div>
                          <StatusBadge value={action.status} styles={ACTION_STATUS_STYLES} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {Object.entries(action.payload || {}).map(([key, value]) => (
                            <div key={key} className="rounded-xl bg-gray-50 dark:bg-black/10 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-500">{prettyFieldLabel(key)}</p>
                              <p className="mt-1 text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{previewValue(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-3">Resolverlo por WhatsApp</p>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] px-3 py-3">
                      <p className="text-[12px] text-gray-600 dark:text-gray-300">
                        Folio actual:
                        <span className="ml-2 font-mono text-[11px] text-gray-900 dark:text-white">{selectedRun.id}</span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-3 py-3 text-[12px] text-gray-700 dark:text-gray-300 space-y-2">
                      <p><span className="font-mono text-[11px]">/pendientes</span> para ver todo lo que espera tu decision.</p>
                      <p><span className="font-mono text-[11px]">/aprobar {selectedRun.id}</span> para autorizar este caso.</p>
                      <p><span className="font-mono text-[11px]">/rechazar {selectedRun.id}</span> para detener este caso.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 dark:border-white/[0.06] px-6 py-10 text-center text-[13px] text-gray-500 dark:text-gray-500">
              Selecciona un caso para ver el detalle.
            </div>
          )}

          {bridge.remoteNode ? (
            <details className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Equipos conectados</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500">Avanzado. Solo para operar otra computadora o revisar una vista remota.</p>
                </div>
                <StatusBadge value={hostStatus?.running ? 'completed' : 'failed'} styles={RUN_STATUS_STYLES} />
              </div>
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">Host remoto</p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">{hostStatus?.local_url || 'Sin URL local'}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className={inputClass} value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="Nombre nodo" />
                <input className={inputClass} value={nodeBaseUrl} onChange={(event) => setNodeBaseUrl(event.target.value)} placeholder="Base URL" />
                <input className={inputClass} value={nodeToken} onChange={(event) => setNodeToken(event.target.value)} placeholder="Token" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                  onClick={() => void runAction('register-remote-node', async () => {
                    const result = await registerRemoteNode({ name: nodeName.trim(), base_url: nodeBaseUrl.trim(), token: nodeToken.trim() });
                    if (!result.success) throw new Error(result.error || 'No pude registrar el nodo.');
                    setNodeName('');
                    setNodeBaseUrl('http://127.0.0.1:47825');
                    setNodeToken('');
                    await refreshOverview(true);
                    setNotice(`Nodo registrado: ${result.node?.name || 'nuevo nodo'}.`);
                  })}
                  disabled={actionKey === 'register-remote-node' || !nodeName.trim() || !nodeBaseUrl.trim() || !nodeToken.trim()}
                >
                  {actionKey === 'register-remote-node' ? 'Registrando...' : 'Registrar nodo'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-[13px] font-semibold transition disabled:opacity-40"
                  onClick={() => void runAction('toggle-remote-host', async () => {
                    if (!hostStatus) return;
                    const result = await updateRemoteNodeHostConfig({ enabled: !hostStatus.enabled });
                    setHostStatus(result);
                    await refreshOverview(true);
                    setNotice(result.enabled ? 'Host remoto habilitado.' : 'Host remoto deshabilitado.');
                  })}
                  disabled={actionKey === 'toggle-remote-host' || !hostStatus}
                >
                  {actionKey === 'toggle-remote-host' ? 'Aplicando...' : hostStatus?.enabled ? 'Desactivar host' : 'Activar host'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2.5 text-[13px] font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                  onClick={() => void runAction('rotate-remote-token', async () => {
                    const result = await updateRemoteNodeHostConfig({ rotate_token: true });
                    setHostStatus(result);
                    await refreshOverview(true);
                    setNotice('Token remoto rotado.');
                  })}
                  disabled={actionKey === 'rotate-remote-token'}
                >
                  {actionKey === 'rotate-remote-token' ? 'Rotando...' : 'Rotar token'}
                </button>
              </div>
              <div className="space-y-2">
                {nodes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.06] px-4 py-6 text-center text-[12px] text-gray-500 dark:text-gray-500">
                    No hay equipos registrados.
                  </div>
                ) : nodes.map((node) => (
                  <div key={node.id} className="rounded-2xl border border-gray-200 dark:border-white/[0.05] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{node.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">{node.baseUrl}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[11px] font-medium ${node.lastError ? 'text-red-500' : 'text-emerald-500'}`}>{node.lastError ? 'Con error' : 'Saludable'}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600">{node.lastHealthAt ? formatDateTime(node.lastHealthAt) : 'Sin ping'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40"
                        onClick={() => void runAction(`test-node-${node.id}`, async () => {
                          const result = await testRemoteNode(node.id);
                          if (!result.success) throw new Error(result.error || `No pude validar ${node.id}.`);
                          await refreshOverview(true);
                          setNotice(`Nodo ${node.id} validado.`);
                        })}
                        disabled={actionKey === `test-node-${node.id}`}
                      >
                        {actionKey === `test-node-${node.id}` ? 'Probando...' : 'Probar'}
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 py-2 text-[12px] font-semibold text-accent transition disabled:opacity-40"
                        onClick={() => void runAction(`screenshot-node-${node.id}`, async () => {
                          const result = await takeRemoteNodeScreenshot(node.id);
                          if (!result.success || !result.image) throw new Error(result.error || `No pude capturar ${node.id}.`);
                          setRemoteImage({ nodeId: node.id, image: result.image, capturedAt: new Date().toISOString() });
                          setNotice(`Captura tomada desde ${node.id}.`);
                        })}
                        disabled={actionKey === `screenshot-node-${node.id}`}
                      >
                        {actionKey === `screenshot-node-${node.id}` ? 'Capturando...' : 'Captura'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </details>
          ) : null}

          {bridge.remoteNode && remoteImage ? (
            <div className="rounded-3xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] p-4">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-3">Vista remota</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-500 mb-3">
                Nodo {remoteImage.nodeId} - {formatDateTime(remoteImage.capturedAt)}
              </p>
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-black/20">
                <img src={remoteImage.image} alt={`Captura remota ${remoteImage.nodeId}`} className="w-full h-auto object-contain" />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
