import { GuiFailure } from './execution-context';

interface OcrElement { text: string; confidence: number; x: number; y: number }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function element(value: unknown): OcrElement | null {
  const item = object(value), box = object(item.bbox);
  const { x0, y0, x1, y1 } = box;
  if (typeof item.text !== 'string' || item.text.length > 100000 || typeof item.confidence !== 'number' || !Number.isFinite(item.confidence)
    || item.confidence < 0 || item.confidence > 100 || ![x0, y0, x1, y1].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000)) return null;
  if (typeof x0 !== 'number' || typeof x1 !== 'number' || typeof y0 !== 'number' || typeof y1 !== 'number' || x1 < x0 || y1 < y0) return null;
  return { text: item.text, confidence: item.confidence, x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) };
}
/** Page de Tesseract 7: sólo blocks solicitados explícitamente, sin words planos. */
export function selectOcrTarget(result: unknown, query: string): { x: number; y: number; confidence: number } {
  let nodes = 0, characters = 0;
  const list = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) return [];
    nodes += value.length; if (nodes > 50000) throw new GuiFailure('GUI_FAILED');
    return value;
  };
  const words: OcrElement[] = [], lines: OcrElement[] = [];
  const add = (values: OcrElement[], candidate: OcrElement | null) => {
    if (!candidate) return;
    characters += candidate.text.length;
    if (characters > 2000000) throw new GuiFailure('GUI_FAILED');
    values.push(candidate);
  };
  for (const block of list(object(object(result).data).blocks)) for (const paragraph of list(object(block).paragraphs)) for (const line of list(object(paragraph).lines)) {
    add(lines, element(line));
    for (const word of list(object(line).words)) add(words, element(word));
  }
  const lower = query.toLowerCase();
  let matches = words.filter(word => word.confidence > 50 && word.text.toLowerCase().includes(lower));
  if (!matches.length) matches = lines.filter(line => line.confidence > 40 && line.text.toLowerCase().includes(lower));
  if (!matches.length) throw new GuiFailure('GUI_TARGET_NOT_FOUND');
  if (new Set(matches.map(match => `${match.x}:${match.y}`)).size !== 1) throw new GuiFailure('GUI_AMBIGUOUS_TARGET');
  const match = matches[0];
  return { x: match.x, y: match.y, confidence: match.confidence };
}
