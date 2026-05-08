export function extractClientName(title: string): string | null {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  const match = lowerTitle.match(/(?:con|with|:|para|for|-)\s+([a-zA-Z0-9\s]+)/i);

  if (match?.[1]) {
    const words = match[1].trim().split(/\s+/);
    return words.slice(0, 3).join(' ').trim();
  }

  const stripped = title.replace(/reunion|meeting|sync|call|review|entrevista/ig, '').trim();
  return stripped.length > 2 ? stripped : null;
}
