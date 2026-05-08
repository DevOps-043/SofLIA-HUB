import type { ProactivePayload } from './types';

export function composeMessageFallback(payload: ProactivePayload): string {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  let message = `${greeting}, ${payload.userName} 👋\n\n`;
  message += '📋 *Resumen de Pendientes*\n';
  message += `🕐 ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n\n`;

  if (payload.calendarEvents.length > 0) {
    message += '📅 *Eventos del Calendario:*\n';
    for (const event of payload.calendarEvents) {
      message += `  • ${event.title} — ${event.start} a ${event.end}\n`;
      if (event.location) message += `    📍 ${event.location}\n`;
    }
    message += '\n';
  }

  appendTaskSummary(payload, (chunk) => { message += chunk; });
  if (payload.systemAlerts.length > 0) {
    message += '🖥️ *Alertas del Sistema:*\n';
    for (const alert of payload.systemAlerts) message += `  • ${alert.description}\n`;
    message += '\n';
  }

  return `${message}— SofLIA 💜`;
}

function appendTaskSummary(payload: ProactivePayload, append: (chunk: string) => void): void {
  if (payload.urgentTasks.length === 0) return;
  const overdue = payload.urgentTasks.filter((task) => task.isOverdue);
  const dueToday = payload.urgentTasks.filter((task) => task.isDueToday);
  if (overdue.length > 0) {
    append(`⚠️ *Tareas VENCIDAS (${overdue.length}):*\n`);
    for (const task of overdue) append(`  • ${task.title}${task.projectName ? ` (${task.projectName})` : ''}\n`);
    append('\n');
  }
  if (dueToday.length > 0) {
    append(`📌 *Vencen HOY (${dueToday.length}):*\n`);
    for (const task of dueToday) append(`  • ${task.title}${task.projectName ? ` (${task.projectName})` : ''}\n`);
    append('\n');
  }
}
