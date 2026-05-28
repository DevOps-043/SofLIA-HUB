import { GoogleGenerativeAI } from '@google/generative-ai';
import { composeMessageFallback } from './fallback-message';
import type { ProactivePayload } from './types';

export async function composeProactiveMessage(
  apiKey: string,
  payload: ProactivePayload,
): Promise<string | null> {
  if (!apiKey) return composeMessageFallback(payload);
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent(buildProactivePrompt(payload));
    return result.response.text() || composeMessageFallback(payload);
  } catch (error) {
    console.warn('[ProactiveService] Gemini compose error, using fallback:', error);
    return composeMessageFallback(payload);
  }
}

function buildProactivePrompt(payload: ProactivePayload): string {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  return `Eres SofLIA, una asistente virtual proactiva e inteligente. Tu tarea es componer un mensaje de WhatsApp amigable y conciso para notificar al usuario sobre sus pendientes del día.

REGLAS:
- Habla en español, de forma natural y cálida como una asistente personal
- No uses markdown pesado (no ### ni **bold**), usa solo emojis y texto plano
- Sé concisa: máximo 300 palabras
- Si hay tareas vencidas, dale prioridad y urgencia amable
- El saludo debe ser "${greeting}, ${payload.userName}"
- Firma como "SofLIA 💜"
- Usa emojis estratégicamente (📅 para calendario, ✅ para tareas, ⚠️ para alertas)
- Formatea la hora actual: ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}

DATOS A INCLUIR:

${buildCalendarPrompt(payload)}

${buildTasksPrompt(payload)}

${buildSystemPrompt(payload)}

Compón el mensaje ahora. Solo responde con el mensaje, sin explicaciones adicionales.`;
}

function buildCalendarPrompt(payload: ProactivePayload): string {
  if (payload.calendarEvents.length === 0) return 'No hay eventos de calendario hoy.';
  return `📅 EVENTOS DEL CALENDARIO (${payload.calendarEvents.length}):
${payload.calendarEvents.map((event) => `- "${event.title}" de ${event.start} a ${event.end}${event.location ? ` en ${event.location}` : ''}`).join('\n')}`;
}

function buildTasksPrompt(payload: ProactivePayload): string {
  if (payload.urgentTasks.length === 0) return 'No hay tareas urgentes.';
  return `✅ TAREAS URGENTES (${payload.urgentTasks.length}):
${payload.urgentTasks.map((task) => `- "${task.title}" [${task.status}]${task.priority ? ` (${task.priority})` : ''}${task.projectName ? ` — Proyecto: ${task.projectName}` : ''} — ${task.isOverdue ? '⚠️ VENCIDA' : 'Vence hoy'}`).join('\n')}`;
}

function buildSystemPrompt(payload: ProactivePayload): string {
  if (payload.systemAlerts.length === 0) return '';
  return `🖥️ ALERTAS DEL SISTEMA (${payload.systemAlerts.length}):
${payload.systemAlerts.map((alert) => `- ${alert.description}`).join('\n')}`;
}
