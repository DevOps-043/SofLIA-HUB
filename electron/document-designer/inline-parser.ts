import { ShadingType, TextRun } from 'docx';
import { COLORS } from './colors';
import type { ParsedInline } from './types';

export function parseInline(text: string): ParsedInline[] {
  const parts: ParsedInline[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ text: text.slice(lastIdx, match.index) });
    }
    if (match[2]) {
      parts.push({ text: match[2], bold: true });
    } else if (match[3]) {
      parts.push({ text: match[3], italic: true });
    } else if (match[4]) {
      parts.push({ text: match[4], code: true });
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx) });
  }

  return parts.length > 0 ? parts : [{ text }];
}

export function inlineToRuns(inlines: ParsedInline[], baseSize: number = 22): TextRun[] {
  return inlines.map((part) => {
    const opts: Record<string, any> = {
      text: part.text,
      size: baseSize,
      font: part.code ? 'Consolas' : 'Calibri',
      color: COLORS.text,
    };
    if (part.bold) opts.bold = true;
    if (part.italic) opts.italics = true;
    if (part.code) {
      opts.shading = { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F0F0' };
      opts.size = 20;
    }
    return new TextRun(opts);
  });
}
