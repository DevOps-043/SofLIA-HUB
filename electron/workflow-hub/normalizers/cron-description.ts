const WEEKDAY_MAP: Record<string, string> = {
  '0': 'Domingo',
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miercoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sabado',
  '7': 'Domingo',
};

export function describeCron(cronExpression: string): string {
  const normalized = String(cronExpression || '').trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) return normalized;

  const [minuteRaw, hourRaw, , , dayOfWeekRaw] = parts;
  const minute = Number(minuteRaw);
  const hour = Number(hourRaw);
  const timeLabel = Number.isFinite(hour) && Number.isFinite(minute)
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : `${hourRaw}:${minuteRaw}`;

  if (dayOfWeekRaw === '1-5') return `Lunes a viernes a las ${timeLabel}`;
  if (dayOfWeekRaw === '*') return `Todos los dias a las ${timeLabel}`;
  return `${WEEKDAY_MAP[dayOfWeekRaw] || normalized} a las ${timeLabel}`;
}
