import { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun } from 'docx';
import { DOCUMENT_COLORS, type DocumentDesign } from '../../src/shared/document-design';
import { inlineToRuns, parseInline } from './inline-parser';
import type { DocumentBlock } from './content-model';

export function buildParagraph(block: Exclude<DocumentBlock, { kind: 'table' }>, design: DocumentDesign, listInstance = 0, keepNext = false): Paragraph {
  if (block.kind === 'rule') return new Paragraph({ spacing: { before: 120, after: 180 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCUMENT_COLORS.border } } });
  if (block.kind === 'code') return new Paragraph({
    children: block.text.split('\n').flatMap((text, index) => [new TextRun({ text, ...(index ? { break: 1 } : {}), font: 'Consolas', size: 20, color: DOCUMENT_COLORS.text })]),
    spacing: { before: 120, after: 180, line: 264 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: DOCUMENT_COLORS.code }, indent: { left: 180, right: 180 },
  });
  if (block.kind === 'heading') {
    const level = Math.min(3, block.level);
    const headings = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
    return new Paragraph({ heading: headings[level - 1], children: inlineToRuns(parseInline(block.text), design.headingSizes[level - 1], design, DOCUMENT_COLORS.heading), keepNext: true, keepLines: true });
  }
  const children = inlineToRuns(parseInline(block.text), design.bodySize, design);
  if (block.kind === 'list') return new Paragraph({
    children, numbering: { reference: block.ordered ? `numbered-list-${listInstance}` : 'bullet-list', level: block.level, instance: listInstance },
    spacing: { after: 70, line: design.line }, widowControl: true,
    indent: { left: 360 * (block.level + 1), hanging: 260 },
    keepNext,
  });
  return new Paragraph({ children, alignment: AlignmentType.LEFT, widowControl: true,
    spacing: { after: design.paragraphAfter, line: design.line },
    ...(block.kind === 'quote' ? { indent: { left: 300, right: 180 } } : {}),
  });
}
