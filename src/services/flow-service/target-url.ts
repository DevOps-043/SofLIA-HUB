export function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!,;:]+$/g, '').trim();
}

export function normalizePotentialUrl(rawValue: string): string | null {
  const value = stripTrailingPunctuation(rawValue);
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value)) {
    return `https://${value}`;
  }

  return null;
}

export function resolveKnownTargetUrl(rawTarget: string): string | null {
  const normalized = stripTrailingPunctuation(rawTarget).toLowerCase();
  if (!normalized) {
    return null;
  }

  const aliases: Array<{ terms: string[]; url: string }> = [
    { terms: ['chatgpt', 'chat gpt', 'chat g p t'], url: 'https://chatgpt.com' },
    { terms: ['gmail'], url: 'https://mail.google.com' },
    { terms: ['google calendar', 'calendar', 'calendario de google'], url: 'https://calendar.google.com' },
    { terms: ['youtube'], url: 'https://www.youtube.com' },
  ];

  const match = aliases.find((item) => item.terms.some((term) => normalized === term));
  return match?.url || null;
}
