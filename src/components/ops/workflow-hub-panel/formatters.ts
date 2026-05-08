import type { PassiveScheduleFrequency } from './types';

const STATUS_STYLES: Record<string, string> = {
  pending_approval: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  in_progress: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  attention: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  available: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  disconnected: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
  setup_required: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  blocked: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/20',
  error: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/20',
  system: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20',
  approved: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/20',
  executed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  skipped: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
};

const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Domingo',
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miercoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sabado',
};

export function formatDateTime(value?: string | null): string {
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

export function previewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => previewValue(item)).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (value === null || value === undefined || value === '') return 'n/d';
  return String(value);
}

export function prettyValue(value: string): string {
  return value.replace(/_/g, ' ');
}

export function tone(value: string): string {
  return STATUS_STYLES[value] || 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20';
}

export function buildCronExpression(frequency: PassiveScheduleFrequency, time: string, weekday: string): string {
  const [hourRaw, minuteRaw] = (time || '08:00').split(':');
  const hour = Number(hourRaw || 8);
  const minute = Number(minuteRaw || 0);
  if (frequency === 'weekdays') return `${minute} ${hour} * * 1-5`;
  if (frequency === 'weekly') return `${minute} ${hour} * * ${weekday || '1'}`;
  return `${minute} ${hour} * * *`;
}

export function describeSchedule(frequency: PassiveScheduleFrequency, time: string, weekday: string): string {
  const timeLabel = time || '08:00';
  if (frequency === 'weekdays') return `Lunes a viernes a las ${timeLabel}`;
  if (frequency === 'weekly') return `${WEEKDAY_LABELS[weekday || '1'] || 'Lunes'} a las ${timeLabel}`;
  return `Todos los dias a las ${timeLabel}`;
}
