import { searchClipboardItems } from '../clipboard-ai-assistant/search';
import type { ClipboardItem } from './types';

export function searchClipboardHistory(query: string, history: ClipboardItem[]): Promise<string> {
  return searchClipboardItems(history, query);
}
