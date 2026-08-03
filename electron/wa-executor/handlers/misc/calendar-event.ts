import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildResponse, errorResponse, type FunctionResponse } from '../../types';

const ICS_CLEANUP_DELAY_MS = 10000;
const SPANISH_DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export async function createCalendarEvent(toolArgs: Record<string, any>): Promise<FunctionResponse> {
  const title = toolArgs.title || 'Evento';
  const startDate = new Date(toolArgs.start_date);
  const endDate = toolArgs.end_date ? new Date(toolArgs.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
  const icsPath = path.join(app.getPath('temp'), `soflia_event_${Date.now()}.ics`);

  await fs.writeFile(icsPath, buildIcsContent(toolArgs, title, startDate, endDate), 'utf-8');
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

function buildIcsContent(toolArgs: Record<string, any>, title: string, startDate: Date, endDate: Date): string {
  const description = toolArgs.description || '';
  const location = toolArgs.location || '';

  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pulse Hub//WhatsApp Agent//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:soflia-${Date.now()}@sofliaHub`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'STATUS:CONFIRMED', 'BEGIN:VALARM', 'TRIGGER:-PT15M',
    'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter((line) => line).join('\r\n');
}

function formatIcsDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function formatHumanDate(date: Date, title: string): string {
  const dayName = SPANISH_DAYS[date.getDay()];
  const monthName = SPANISH_MONTHS[date.getMonth()];
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return `Evento creado y abierto en el calendario: "${title}" el ${dayName} ${date.getDate()} de ${monthName} de ${date.getFullYear()} a las ${timeStr}`;
}
