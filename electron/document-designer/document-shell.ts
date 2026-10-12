import { AlignmentType, Document as DocxDocument, Footer, Header, NumberFormat, PageNumber, Paragraph, TextRun, type Table } from 'docx';
import { DOCUMENT_COLORS, DOCUMENT_PAGE, type DocumentDesign } from '../../src/shared/document-design';

export function buildDocument(title: string, children: (Paragraph | Table)[], design: DocumentDesign, cover: boolean, listStarts: Record<number, number>): DocxDocument {
  return new DocxDocument({
    title, creator: 'SofLIA', description: 'Documento editable',
    numbering: { config: [{ reference: 'bullet-list', start: 1, ordered: false }, ...Object.entries(listStarts).map(([instance, start]) => ({ reference: `numbered-list-${instance}`, start, ordered: true }))].map(({ reference, start, ordered }) => ({ reference, levels: Array.from({ length: 9 }, (_, level) => ({
      level, format: ordered ? NumberFormat.DECIMAL : NumberFormat.BULLET,
      text: ordered ? `%${level + 1}.` : '•', start: level === 0 ? start : 1,
      alignment: AlignmentType.START,
      style: { run: { font: design.font }, paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } },
    })) })) },
    styles: {
      default: { document: { run: { font: design.font, size: design.bodySize, color: DOCUMENT_COLORS.text }, paragraph: { spacing: { line: design.line, after: design.paragraphAfter } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: design.font, size: design.titleSize, bold: true, color: DOCUMENT_COLORS.heading }, paragraph: { spacing: { after: 220 }, keepNext: true } },
        { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', run: { font: design.font, size: 26, color: DOCUMENT_COLORS.heading } },
        { id: 'SofLIAMetadata', name: 'SofLIA Metadata', basedOn: 'Normal', run: { font: design.font, size: 18, color: DOCUMENT_COLORS.muted } },
        ...design.headingSizes.map((size, index) => ({ id: `Heading${index + 1}`, name: `heading ${index + 1}`, basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: design.font, size, bold: true, color: DOCUMENT_COLORS.heading }, paragraph: { spacing: { before: index === 0 ? 360 : 280, after: 140 }, keepNext: true, keepLines: true, outlineLevel: index } })),
      ],
    },
    sections: [{
      properties: { titlePage: cover, page: { size: { width: DOCUMENT_PAGE.width, height: DOCUMENT_PAGE.height }, margin: { top: DOCUMENT_PAGE.margin, bottom: DOCUMENT_PAGE.margin, left: DOCUMENT_PAGE.margin, right: DOCUMENT_PAGE.margin, header: 650, footer: 650 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: title.length > 80 ? title.slice(0, 77) + '…' : title, font: design.font, size: 18, color: DOCUMENT_COLORS.heading })], spacing: { after: 0 }, alignment: AlignmentType.RIGHT })] }), ...(cover ? { first: new Header({ children: [] }) } : {}) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'SofLIA  ·  Página ', font: design.font, size: 18, color: DOCUMENT_COLORS.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: DOCUMENT_COLORS.muted }), new TextRun({ text: ' de ', size: 18, color: DOCUMENT_COLORS.muted }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: DOCUMENT_COLORS.muted })], alignment: AlignmentType.RIGHT, spacing: { after: 0 } })] }), ...(cover ? { first: new Footer({ children: [] }) } : {}) },
      children,
    }],
  });
}
