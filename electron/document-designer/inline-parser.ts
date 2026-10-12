import { ExternalHyperlink, ShadingType, TextRun, type IRunOptions } from 'docx';
import { DOCUMENT_COLORS, resolveDocumentDesign, type DocumentDesign } from '../../src/shared/document-design';
import type { ParsedInline } from './types';

export function parseInline(text: string): ParsedInline[] {
  const parts: ParsedInline[] = [];
  const regex = /(`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*]+)\*)/g;
  let last = 0; let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    if (match[2]) parts.push({ text: match[2], code: true });
    else if (match[3]) {
      const href = /^(https?:\/\/|mailto:)/i.test(match[4]) ? match[4] : undefined;
      // Un destino no seguro se conserva como texto, nunca como vínculo ejecutable.
      if (!href) parts.push({ text: match[0] });
      else parts.push(...parseInline(match[3]).map(part => ({ ...part, href })));
    } else if (match[5] || match[6]) parts.push({ text: match[5] ?? match[6], bold: true });
    else parts.push({ text: match[7], italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
export function inlineToRuns(inlines: ParsedInline[], baseSize = 22, design: DocumentDesign = resolveDocumentDesign(), color: string = DOCUMENT_COLORS.text): (TextRun | ExternalHyperlink)[] {
  return inlines.map(part => {
    const options: IRunOptions = {
      text: part.text, size: part.code ? Math.min(baseSize, 20) : baseSize,
      font: part.code ? 'Consolas' : design.font, color,
      bold: part.bold, italics: part.italic,
      ...(part.code ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: DOCUMENT_COLORS.code } } : {}),
      ...(part.href ? { underline: {} } : {}),
    };
    const run = new TextRun(options);
    return part.href ? new ExternalHyperlink({ link: part.href, children: [run] }) : run;
  });
}
