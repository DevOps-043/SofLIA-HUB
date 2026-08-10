import type { BrowserReadingWordTiming } from '../../services/integrated-browser-service';

// El primer lote debe llegar antes que una frase larga termine de sintetizarse.
// Los lotes posteriores caben holgadamente durante la reproducción del actual.
export const SPEECH_FIRST_SEGMENT_MAX_CHARS = 180;
export const SPEECH_SEGMENT_MAX_CHARS = 480;
export const SPEECH_PREFETCH_AHEAD = 2;

export interface BrowserReadingSegment {
  start: number;
  end: number;
}

export function buildReadingSegments(
  text: string,
  maxChars = SPEECH_SEGMENT_MAX_CHARS,
  firstSegmentMaxChars = Math.min(SPEECH_FIRST_SEGMENT_MAX_CHARS, maxChars),
): BrowserReadingSegment[] {
  if (!text.trim() || maxChars < 100) return [];
  const segments: BrowserReadingSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    while (cursor < text.length && /\s/u.test(text[cursor])) cursor += 1;
    if (cursor >= text.length) break;
    const segmentLimit = segments.length === 0
      ? Math.max(100, Math.min(maxChars, firstSegmentMaxChars))
      : maxChars;
    const hardEnd = Math.min(text.length, cursor + segmentLimit);
    let end = hardEnd;
    if (hardEnd < text.length) {
      const slice = text.slice(cursor, hardEnd);
      const paragraph = slice.lastIndexOf('\n\n');
      const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
      const word = slice.lastIndexOf(' ');
      const boundary = paragraph >= segmentLimit * 0.45 ? paragraph : sentence >= segmentLimit * 0.55 ? sentence + 1 : word;
      if (boundary > segmentLimit * 0.35) end = cursor + boundary;
    }
    while (end > cursor && /\s/u.test(text[end - 1])) end -= 1;
    if (end <= cursor) end = hardEnd;
    segments.push({ start: cursor, end });
    cursor = end;
  }
  return segments;
}

export function findTimingAtTime(timings: BrowserReadingWordTiming[], seconds: number): BrowserReadingWordTiming | null {
  let low = 0;
  let high = timings.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const timing = timings[middle];
    if (seconds < timing.startTime) high = middle - 1;
    else if (seconds > timing.endTime) low = middle + 1;
    else return timing;
  }
  return timings[Math.max(0, Math.min(timings.length - 1, high))] ?? null;
}
