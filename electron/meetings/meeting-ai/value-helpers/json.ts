export function parseJson<T>(rawText: string): T {
  const normalized = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '');
  return JSON.parse(normalized) as T;
}
