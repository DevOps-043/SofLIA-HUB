import { HeadingLevel, Paragraph, TextRun } from 'docx';
import { DOCUMENT_COLORS, type DocumentDesign } from '../../src/shared/document-design';

export function createTitleBlock(title: string, design: DocumentDesign, fullCover: boolean, subtitle?: string, author?: string): Paragraph[] {
  const paragraphs = [new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: title, font: design.font, size: fullCover ? 64 : design.titleSize, bold: true, color: DOCUMENT_COLORS.heading })],
    spacing: { before: fullCover ? 1800 : 0, after: 220 }, keepNext: true, keepLines: true,
  })];
  if (subtitle) paragraphs.push(new Paragraph({ style: 'Subtitle', children: [new TextRun({ text: subtitle, color: DOCUMENT_COLORS.heading, size: 26, font: design.font })], spacing: { after: 200 }, keepNext: true }));
  paragraphs.push(new Paragraph({
    style: 'SofLIAMetadata', children: [new TextRun({ text: [author ?? 'SofLIA', new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })].join(' · '), font: design.font, size: 18, color: DOCUMENT_COLORS.muted })],
    spacing: { after: fullCover ? 0 : 360 },
  }));
  return paragraphs;
}
