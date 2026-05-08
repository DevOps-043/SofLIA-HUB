export function extractClockTime(normalized: string): [number, number] | null {
  const timeMatch = normalized.match(/\b(?:a las|a la|alas)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) return null;
  return [hour, minute];
}
