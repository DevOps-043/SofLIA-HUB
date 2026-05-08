import {
  CHARS_PER_TOKEN,
  CHUNK_OVERLAP,
  CHUNK_TOKENS,
} from './constants';

export function chunkMemoryText(text: string): string[] {
  const chunkSize = CHUNK_TOKENS * CHARS_PER_TOKEN;
  const overlap = CHUNK_OVERLAP * CHARS_PER_TOKEN;
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    const searchStart = Math.max(start + chunkSize - overlap, start);
    const segment = text.slice(searchStart, end);
    const lastNewline = segment.lastIndexOf('\n');
    const lastPeriod = segment.lastIndexOf('. ');
    if (lastNewline > 0) end = searchStart + lastNewline + 1;
    else if (lastPeriod > 0) end = searchStart + lastPeriod + 2;
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks.filter((chunk) => chunk.trim().length > 20);
}
