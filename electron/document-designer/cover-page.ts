import { AlignmentType, Paragraph, TextRun } from 'docx';
import { COLORS } from './colors';

export function createCoverPage(title: string, subtitle?: string, author?: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (let spacing = 0; spacing < 6; spacing += 1) {
    paragraphs.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: '━'.repeat(40), color: COLORS.coverAccent, size: 14 })],
    alignment: AlignmentType.CENTER,
  }));

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 60, color: COLORS.heading1, font: 'Calibri' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  }));

  if (subtitle) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: subtitle,
        size: 28,
        color: COLORS.muted,
        font: 'Calibri',
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: '━'.repeat(40), color: COLORS.coverAccent, size: 14 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: author || 'Generado por SofLIA', size: 22, color: COLORS.muted, font: 'Calibri' })],
    alignment: AlignmentType.CENTER,
  }));

  paragraphs.push(new Paragraph({
    children: [new TextRun({
      text: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
      size: 20,
      color: COLORS.muted,
      font: 'Calibri',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
  }));

  paragraphs.push(new Paragraph({ children: [], pageBreakBefore: true }));
  return paragraphs;
}
