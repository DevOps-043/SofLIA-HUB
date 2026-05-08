import type { ClipboardConfig, ClipboardItem } from './types';

const LONG_SECRET_PATTERN = /[A-Za-z0-9-_]{25,}/;
const SENSITIVE_WORD_PATTERN = /(password|contrase\u00f1a|token|secret|key)/i;

export function readClipboardText(clipboardApi: { readText: () => string }): string {
  try {
    return clipboardApi.readText();
  } catch {
    return '';
  }
}

export function addClipboardText(
  history: ClipboardItem[],
  currentText: string,
  config: ClipboardConfig,
): ClipboardItem | null {
  if (!currentText || currentText.trim() === '') return null;

  const existingIndex = history.findIndex((item) => item.text === currentText);
  if (existingIndex !== -1) history.splice(existingIndex, 1);

  const item = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    text: currentText,
  };
  history.unshift(item);

  if (history.length > (config.maxHistorySize || 100)) {
    history.pop();
  }
  return item;
}

export function formatClipboardLogText(text: string): string {
  if (LONG_SECRET_PATTERN.test(text) || SENSITIVE_WORD_PATTERN.test(text)) {
    return '***[INFORMACION_SENSIBLE_OCULTA]***';
  }

  const compactText = text.replace(/\n/g, ' ');
  return compactText.length > 50 ? `${compactText.substring(0, 50)}...` : compactText;
}
