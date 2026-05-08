import { AlignmentType, BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun } from 'docx';
import { COLORS } from './colors';
import { inlineToRuns, parseInline } from './inline-parser';

export function createHorizontalRule(): Paragraph {
  return new Paragraph({
    children: [],
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border } },
  });
}

export function createHeading(trimmed: string): Paragraph | null {
  if (trimmed.startsWith('### ')) {
    return new Paragraph({
      children: [new TextRun({ text: trimmed.replace(/^###\s+/, ''), bold: true, size: 26, color: COLORS.heading3, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240, after: 80 },
    });
  }
  if (trimmed.startsWith('## ')) {
    return new Paragraph({
      children: [new TextRun({ text: trimmed.replace(/^##\s+/, ''), bold: true, size: 30, color: COLORS.heading2, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border } },
    });
  }
  if (!trimmed.startsWith('# ')) return null;
  return new Paragraph({
    children: [new TextRun({ text: trimmed.replace(/^#\s+/, ''), bold: true, size: 36, color: COLORS.heading1, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 120 },
  });
}

export function createListParagraph(trimmed: string, originalLine: string): Paragraph | null {
  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
  if (numberedMatch) {
    return new Paragraph({
      children: inlineToRuns(parseInline(numberedMatch[2])),
      numbering: { reference: 'numbered-list', level: 0 },
      spacing: { before: 40, after: 40 },
      indent: { left: 360 },
    });
  }
  if (/^[-•*]\s+/.test(trimmed)) {
    return new Paragraph({
      children: inlineToRuns(parseInline(trimmed.replace(/^[-•*]\s+/, ''))),
      bullet: { level: 0 },
      spacing: { before: 40, after: 40 },
      indent: { left: 360 },
    });
  }
  if (!/^\s{2,}[-•*]\s+/.test(originalLine)) return null;
  return new Paragraph({
    children: inlineToRuns(parseInline(originalLine.trim().replace(/^[-•*]\s+/, ''))),
    bullet: { level: 1 },
    spacing: { before: 20, after: 20 },
    indent: { left: 720 },
  });
}

export function createCodeBlock(codeLines: string[]): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: codeLines.join('\n'), font: 'Consolas', size: 18, color: '1A1A1A' })],
    spacing: { before: 100, after: 100 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' },
    indent: { left: 200, right: 200 },
  });
}

export function createRegularParagraph(trimmed: string): Paragraph {
  return new Paragraph({
    children: inlineToRuns(parseInline(trimmed)),
    spacing: { before: 60, after: 80 },
    alignment: AlignmentType.JUSTIFIED,
  });
}
