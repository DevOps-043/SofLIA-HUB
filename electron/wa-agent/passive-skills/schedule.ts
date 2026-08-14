import { extractClockTime } from './clock-time';
import { normalizeForIntent } from './normalize';

const NON_RECURRING_DAY_REGEX = /\b(manana|hoy|esta tarde|esta noche)\b/;
const RECURRING_REGEX = /\b(cada|todos los dias|diario|diariamente|lunes|martes|miercoles|jueves|viernes|sabado|domingo|entre semana|dias laborales|cada hora)\b/;

export function extractPassiveSchedule(text: string): { cronExpression: string; scheduleLabel: string } | null {
  const normalized = normalizeForIntent(text);
  const hourly = extractHourlySchedule(normalized);
  if (hourly) return hourly;

  const time = extractClockTime(normalized);
  if (!time) return null;
  if (NON_RECURRING_DAY_REGEX.test(normalized) && !RECURRING_REGEX.test(normalized)) return null;

  const [hour, minute] = time;
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const weekdaySchedule = extractWeekdaySchedule(normalized, hour, minute, timeLabel);
  if (weekdaySchedule) return weekdaySchedule;

  if (/\b(todos los dias|cada dia|diario|diariamente|cada manana|todas las mananas)\b/.test(normalized)
    || /\ba las\b/.test(normalized)) {
    return {
      cronExpression: `${minute} ${hour} * * *`,
      scheduleLabel: `Todos los dias a las ${timeLabel}`,
    };
  }

  return null;
}

function extractHourlySchedule(normalized: string): { cronExpression: string; scheduleLabel: string } | null {
  if (/\bcada\s+(\d+)\s+hora(s)?\b/.test(normalized)) {
    const match = normalized.match(/\bcada\s+(\d+)\s+hora(s)?\b/);
    const interval = Math.max(1, Math.min(24, Number(match?.[1] || 1)));
    return { cronExpression: `0 */${interval} * * *`, scheduleLabel: `Cada ${interval} hora${interval === 1 ? '' : 's'}` };
  }
  if (/\bcada\s+hora\b/.test(normalized)) {
    return { cronExpression: '0 * * * *', scheduleLabel: 'Cada hora' };
  }
  return null;
}

function extractWeekdaySchedule(
  normalized: string,
  hour: number,
  minute: number,
  timeLabel: string,
): { cronExpression: string; scheduleLabel: string } | null {
  if (/\b(lunes a viernes|lun a vie|entre semana|dias laborales)\b/.test(normalized)) {
    return { cronExpression: `${minute} ${hour} * * 1-5`, scheduleLabel: `Lunes a viernes a las ${timeLabel}` };
  }

  const weekdayMap: Array<{ regex: RegExp; cron: string; label: string }> = [
    { regex: /\b(lunes|cada lunes|los lunes)\b/, cron: '1', label: 'Lunes' },
    { regex: /\b(martes|cada martes|los martes)\b/, cron: '2', label: 'Martes' },
    { regex: /\b(miercoles|cada miercoles|los miercoles)\b/, cron: '3', label: 'Miercoles' },
    { regex: /\b(jueves|cada jueves|los jueves)\b/, cron: '4', label: 'Jueves' },
    { regex: /\b(viernes|cada viernes|los viernes)\b/, cron: '5', label: 'Viernes' },
    { regex: /\b(sabado|cada sabado|los sabados)\b/, cron: '6', label: 'Sabado' },
    { regex: /\b(domingo|cada domingo|los domingos)\b/, cron: '0', label: 'Domingo' },
  ];
  const weekday = weekdayMap.find((candidate) => candidate.regex.test(normalized));
  return weekday
    ? { cronExpression: `${minute} ${hour} * * ${weekday.cron}`, scheduleLabel: `${weekday.label} a las ${timeLabel}` }
    : null;
}
