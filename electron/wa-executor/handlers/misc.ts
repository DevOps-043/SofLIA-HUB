/**
 * Handlers misceláneos del agente WhatsApp.
 *
 * Cubre tools que no encajan en categorías más grandes:
 *  - Búsqueda inteligente de archivos y web (`smart_find_file`, `web_search`, `read_webpage`)
 *  - Search semántica del clipboard y filesystem (`search_clipboard_history`, `semantic_file_search`)
 *  - Browser profiles (`list_browser_profiles`, `reset_browser_profile`)
 *  - Calendar event creation legacy via .ics (`create_calendar_event`)
 *  - Task scheduler (`task_scheduler`, `list_scheduled_tasks`, `delete_scheduled_task`)
 *  - Agent task queue (`list_active_tasks`, `cancel_background_task`)
 *  - Neural organizer (`neural_organizer_status`, `neural_organizer_toggle`)
 */

import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { handleTaskQueueTool } from '../../agent-task-queue';
import { SmartSearchTool } from '../../smart-search-tool';
import { handleTaskSchedulerTool } from '../../task-scheduler';
import { readWebpage, smartFindFile, webSearch } from '../../whatsapp-prompts';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

const SEARCH_TOOLS = new Set(['smart_find_file', 'web_search', 'read_webpage', 'search_clipboard_history', 'semantic_file_search']);
const BROWSER_PROFILE_TOOLS = new Set(['list_browser_profiles', 'reset_browser_profile']);
const SCHEDULER_TOOLS = new Set(['task_scheduler', 'list_scheduled_tasks', 'delete_scheduled_task']);
const TASK_QUEUE_TOOLS = new Set(['list_active_tasks', 'cancel_background_task']);
const NEURAL_TOOLS = new Set(['neural_organizer_status', 'neural_organizer_toggle']);
const CALENDAR_TOOLS = new Set(['create_calendar_event']);

const ALL_MISC_TOOLS = new Set([
  ...SEARCH_TOOLS,
  ...BROWSER_PROFILE_TOOLS,
  ...SCHEDULER_TOOLS,
  ...TASK_QUEUE_TOOLS,
  ...NEURAL_TOOLS,
  ...CALENDAR_TOOLS,
]);

export function isMiscTool(name: string): boolean {
  return ALL_MISC_TOOLS.has(name);
}

const ICS_CLEANUP_DELAY_MS = 10000;

const SPANISH_DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatIcsDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function formatHumanDate(date: Date, title: string): string {
  const dayName = SPANISH_DAYS[date.getDay()];
  const monthName = SPANISH_MONTHS[date.getMonth()];
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return `Evento creado y abierto en el calendario: "${title}" el ${dayName} ${date.getDate()} de ${monthName} de ${date.getFullYear()} a las ${timeStr}`;
}

async function createCalendarEvent(toolArgs: Record<string, any>): Promise<FunctionResponse> {
  const title = toolArgs.title || 'Evento';
  const startDate = new Date(toolArgs.start_date);
  const endDate = toolArgs.end_date
    ? new Date(toolArgs.end_date)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  const description = toolArgs.description || '';
  const location = toolArgs.location || '';
  const uid = `soflia-${Date.now()}@sofliaHub`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SofLIA Hub//WhatsApp Agent//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter((l) => l)
    .join('\r\n');

  const icsPath = path.join(app.getPath('temp'), `soflia_event_${Date.now()}.ics`);
  await fs.writeFile(icsPath, icsContent, 'utf-8');

  const openError = await shell.openPath(icsPath);
  setTimeout(() => fs.unlink(icsPath).catch(() => {}), ICS_CLEANUP_DELAY_MS);

  if (openError) {
    return errorResponse('create_calendar_event', `No se pudo abrir el archivo ICS: ${openError}`);
  }
  return buildResponse('create_calendar_event', {
    success: true,
    message: formatHumanDate(startDate, title),
  });
}

export async function executeMiscTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!ALL_MISC_TOOLS.has(toolName)) {
    return null;
  }

  try {
    // Búsqueda
    if (toolName === 'smart_find_file') {
      return buildResponse(toolName, await smartFindFile(toolArgs.filename));
    }
    if (toolName === 'web_search') {
      return buildResponse(toolName, await webSearch(toolArgs.query));
    }
    if (toolName === 'read_webpage') {
      return buildResponse(toolName, await readWebpage(toolArgs.url));
    }
    if (toolName === 'search_clipboard_history') {
      if (!ctx.clipboardAssistant) {
        return errorResponse(toolName, 'Clipboard Assistant no inicializado.');
      }
      const data = await ctx.clipboardAssistant.searchClipboardHistory(toolArgs.query);
      return buildResponse(toolName, { success: true, data });
    }
    if (toolName === 'semantic_file_search') {
      // Lazy-init: el SmartSearchTool puede no estar disponible al arrancar.
      if (!ctx.smartSearch) {
        ctx.smartSearch = new SmartSearchTool();
      }
      return buildResponse(toolName, ctx.smartSearch.searchFiles(toolArgs.query, toolArgs.max_results || 3));
    }

    // Browser profiles del DesktopAgent
    if (BROWSER_PROFILE_TOOLS.has(toolName)) {
      if (!ctx.desktopAgent) {
        return errorResponse(toolName, 'Desktop Agent no inicializado.');
      }
      if (toolName === 'list_browser_profiles') {
        const profiles = await ctx.desktopAgent.listBrowserProfiles();
        return buildResponse(toolName, { success: true, count: profiles.length, profiles });
      }
      if (toolName === 'reset_browser_profile') {
        return buildResponse(
          toolName,
          await ctx.desktopAgent.resetBrowserProfile(String(toolArgs.profile_id || '').trim()),
        );
      }
    }

    // Task scheduler
    if (SCHEDULER_TOOLS.has(toolName)) {
      if (!ctx.taskScheduler) {
        return errorResponse(toolName, 'Task Scheduler no inicializado.');
      }
      const result = await handleTaskSchedulerTool(ctx.taskScheduler, toolName, toolArgs, senderNumber);
      return buildResponse(toolName, result);
    }

    // Agent task queue
    if (TASK_QUEUE_TOOLS.has(toolName)) {
      const result = await handleTaskQueueTool(toolName, toolArgs);
      return buildResponse(toolName, result);
    }

    // Neural organizer
    if (NEURAL_TOOLS.has(toolName)) {
      if (!ctx.neuralOrganizer) {
        return errorResponse(toolName, 'Neural Organizer no inicializado. Configura primero la API key.');
      }
      const result = ctx.neuralOrganizer.handleToolCall(toolName, toolArgs);
      return buildResponse(toolName, result);
    }

    if (toolName === 'create_calendar_event') {
      return createCalendarEvent(toolArgs);
    }

    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
