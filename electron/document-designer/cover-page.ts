import { AlignmentType, HeadingLevel, Paragraph, TextRun, type Table } from 'docx';
import { DOCUMENT_COLORS, type DocumentDesign } from '../../src/shared/document-design';
import { brandLogo, corporateMetadata } from './brand-components';

export function createTitleBlock(title: string, design: DocumentDesign, fullCover: boolean, subtitle?: string, author?: string): (Paragraph | Table)[] {
  const alignment = fullCover && design.corporate ? AlignmentType.CENTER : AlignmentType.LEFT;
  const logo = fullCover && design.corporate ? brandLogo(design, 180, 120) : null;
  const paragraphs: (Paragraph | Table)[] = [
    ...(logo ? [new Paragraph({ style: 'SofLIALogo', children: [logo], alignment, spacing: { before: 480, after: 480 }, keepNext: true })] : []),
    new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: title, font: design.font, size: fullCover && !design.corporate ? 64 : design.titleSize, bold: true, color: design.heading })],
    alignment, spacing: { before: fullCover && !logo ? 1800 : 0, after: fullCover && design.corporate ? 320 : 220 }, keepNext: true, keepLines: true,
  })];
  if (subtitle) paragraphs.push(new Paragraph({ style: 'Subtitle', alignment, children: [new TextRun({ text: subtitle, color: design.corporate ? DOCUMENT_COLORS.muted : design.heading, size: 26, font: design.font })], spacing: { after: fullCover ? 440 : 200 }, keepNext: true }));
  if (design.corporate && fullCover) {
    paragraphs.push(corporateMetadata(design, author));
    return paragraphs;
  }
  paragraphs.push(new Paragraph({
    style: 'SofLIAMetadata', children: [new TextRun({ text: [author ?? 'SofLIA', new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })].join(' · '), font: design.font, size: 18, color: DOCUMENT_COLORS.muted })],
    spacing: { after: fullCover ? 0 : 360 },
  }));
  return paragraphs;
}
