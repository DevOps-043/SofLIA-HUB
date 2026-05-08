export function parseTargetDate(value: unknown): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00`);
  }
  return new Date();
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function pickMeetingEvent(events: Array<{
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  source: 'google' | 'microsoft';
}>, targetDate: Date) {
  const sorted = events
    .slice()
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  if (sorted.length === 0) return null;

  const today = formatDateOnly(targetDate) === formatDateOnly(new Date());
  if (!today) return sorted[0];

  const now = Date.now();
  return sorted.find((event) => event.end.getTime() >= now) || sorted[0];
}
