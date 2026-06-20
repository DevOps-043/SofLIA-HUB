import type { ScheduledTaskInfo } from '../task-scheduler';
import type { WhatsAppService } from '../whatsapp-service';

const HISTORY_DAYS = 21;
const MAX_PREVIOUS_RESULTS = 5;
const MAX_RESULT_CHARS = 900;

export async function buildScheduledTaskPrompt(input: {
  waService: WhatsAppService;
  senderNumber: string;
  task: ScheduledTaskInfo;
}): Promise<string> {
  const prompt = String(input.task.prompt || '').trim();
  const previousResults = await loadPreviousScheduledResults(input);
  const now = new Date();
  const freshnessLines = requiresFreshExternalInfo(prompt)
    ? [
      '',
      'FRESCURA OBLIGATORIA:',
      '- Esta instruccion requiere informacion actual. Usa web_search, web_search_advanced o read_webpage durante esta ejecucion.',
      '- No respondas solo con memoria, conocimiento anterior o mensajes pasados.',
      '- Prioriza fuentes fechadas de hoy o de los ultimos dias segun el tema.',
    ]
    : [];

  const previousBlock = previousResults.length > 0
    ? [
      '',
      'RESULTADOS ENVIADOS EN EJECUCIONES RECIENTES DE ESTA MISMA AUTOMATIZACION:',
      ...previousResults.map((item, index) => `${index + 1}. [${formatDateTime(item.timestamp)}] ${truncate(item.text, MAX_RESULT_CHARS)}`),
      '',
      'Evita repetir esos mismos temas, enlaces, datos, ejemplos o redacciones. Si no encuentras novedades reales, dilo con honestidad y busca otro angulo util.',
    ]
    : [
      '',
      'No hay resultados anteriores registrados para esta automatizacion.',
    ];

  return [
    'Esta es una automatizacion pasiva ya programada.',
    'No la vuelvas a programar ni uses task_scheduler.',
    'Ejecuta ahora la instruccion y responde por WhatsApp con el resultado.',
    `Fecha y hora real de ejecucion: ${formatDateTime(now.toISOString())} (${now.toISOString()}).`,
    `ID de automatizacion: ${input.task.id}.`,
    input.task.name ? `Nombre: ${input.task.name}.` : '',
    ...freshnessLines,
    ...previousBlock,
    '',
    `Solicitud original: ${prompt}`,
  ].filter(Boolean).join('\n');
}

export function recordScheduledTaskResult(input: {
  waService: WhatsAppService;
  jid: string;
  senderNumber: string;
  task: ScheduledTaskInfo;
  response: string;
}): void {
  const response = String(input.response || '').trim();
  if (!response) return;
  input.waService.recordHistory({
    direction: 'system',
    kind: 'text',
    jid: input.jid,
    senderNumber: input.senderNumber,
    groupJid: null,
    isGroup: false,
    text: [
      scheduledTaskMarker(input.task.id),
      `Nombre: ${input.task.name || ''}`,
      `Prompt: ${input.task.prompt}`,
      `Respuesta enviada: ${truncate(response, 2000)}`,
    ].join('\n'),
    source: 'whatsapp-agent',
    metadata: {
      scheduledTaskId: input.task.id,
      scheduledTaskName: input.task.name || null,
      passiveRuleId: input.task.passiveRuleId || null,
    },
  });
}

async function loadPreviousScheduledResults(input: {
  waService: WhatsAppService;
  senderNumber: string;
  task: ScheduledTaskInfo;
}): Promise<Array<{ timestamp: string; text: string }>> {
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const list = (input.waService as any).getConversationHistory;
  if (typeof list !== 'function') return [];

  try {
    const events = await list.call(input.waService, {
      senderNumber: input.senderNumber,
      direction: 'system',
      kind: 'text',
      query: scheduledTaskMarker(input.task.id),
      since,
      limit: MAX_PREVIOUS_RESULTS,
    });
    return Array.isArray(events)
      ? events.map((event) => ({
        timestamp: String(event.timestamp || ''),
        text: stripScheduledTaskMarker(String(event.text || '')),
      })).filter((event) => event.text.trim())
      : [];
  } catch (error: any) {
    console.warn('[WhatsApp Agent] No pude cargar historial de automatizacion:', error?.message || String(error));
    return [];
  }
}

function requiresFreshExternalInfo(prompt: string): boolean {
  return /\b(noticias?|news|actualidad|hoy|reciente|ultim[oa]s?|tendencias?|mercado|clima|precio|cotizacion|curios[oa]s?|dato curioso|efemerides)\b/i
    .test(prompt.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

function scheduledTaskMarker(taskId: string): string {
  return `scheduled-task:${taskId}`;
}

function stripScheduledTaskMarker(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.startsWith('scheduled-task:'))
    .join('\n')
    .replace(/^Respuesta enviada:\s*/im, '')
    .trim();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trim()}...`;
}
