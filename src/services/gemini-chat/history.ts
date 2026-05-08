import type { ConversationMessage } from './types';

export function buildGeminiHistory(history: ConversationMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  const trimmed = history.slice(-50);
  const raw = trimmed
    .filter((msg) => msg.text && msg.text.trim().length > 0)
    .map((msg) => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] }));

  while (raw.length > 0 && raw[0].role === 'model') raw.shift();

  const clean: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const entry of raw) {
    if (clean.length === 0 || clean[clean.length - 1].role !== entry.role) {
      clean.push(entry);
    } else {
      clean[clean.length - 1].parts[0].text += '\n' + entry.parts[0].text;
    }
  }

  if (clean.length > 0 && clean[clean.length - 1].role === 'user') clean.pop();
  return clean;
}
