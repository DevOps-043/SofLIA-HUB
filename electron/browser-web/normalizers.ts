export function inferStartUrl(task: string, explicitUrl?: string): string | null {
  if (explicitUrl) return normalizeUrl(explicitUrl);

  const urlMatch = task.match(/https?:\/\/[^\s)]+/i);
  if (urlMatch) {
    return normalizeUrl(urlMatch[0]);
  }

  const lower = task.toLowerCase();
  if (lower.includes('chatgpt') || lower.includes('chat gpt') || lower.includes('chat.openai.com')) return 'https://chatgpt.com/';
  if (lower.includes('gmail')) return 'https://mail.google.com/';
  if (lower.includes('calendar')) return 'https://calendar.google.com/';
  if (lower.includes('google docs') || lower.includes('documento de google')) return 'https://docs.google.com/';
  if (lower.includes('google drive') || lower.includes('drive')) return 'https://drive.google.com/';
  if (lower.includes('linkedin')) return 'https://www.linkedin.com/';
  if (lower.includes('notion')) return 'https://www.notion.so/';
  if (lower.includes('salesforce')) return 'https://www.salesforce.com/';
  if (lower.includes('hubspot')) return 'https://app.hubspot.com/';
  return null;
}

export function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

export function normalizeComparableUrl(url: string): string {
  return (url || '')
    .trim()
    .replace(/#.*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function normalizeText(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
