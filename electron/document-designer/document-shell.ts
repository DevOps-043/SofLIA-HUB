import { AlignmentType, Document as DocxDocument, Footer, Header, NumberFormat, Paragraph, hashedId, type Table } from 'docx';
import { DOCUMENT_COLORS, type DocumentDesign } from '../../src/shared/document-design';
import { documentFooter, documentHeader } from './brand-components';

export function buildDocument(title: string, children: (Paragraph | Table)[], design: DocumentDesign, cover: boolean, listStarts: Record<number, number>): DocxDocument {
  return new DocxDocument({
    title, creator: 'SofLIA', description: 'Documento editable',
    ...(design.corporate ? { customProperties: [{ name: 'SofLIA.DocumentTheme', value: JSON.stringify({ design: { preset: 'corporate', primaryColor: design.primary, secondaryColor: design.secondary, accentColor: design.accent,
      fontFamily: ['Calibri', 'Arial', 'Georgia'].includes(design.font) ? design.font : 'Arial' }, cover, organizationName: design.organizationName,
      logoPart: design.logo ? 'word/media/' + hashedId(design.logo.png) + '.png' : undefined }) }] } : {}),
    numbering: { config: [{ reference: 'bullet-list', start: 1, ordered: false }, ...Object.entries(listStarts).map(([instance, start]) => ({ reference: `numbered-list-${instance}`, start, ordered: true }))].map(({ reference, start, ordered }) => ({ reference, levels: Array.from({ length: 9 }, (_, level) => ({
      level, format: ordered ? NumberFormat.DECIMAL : NumberFormat.BULLET,
      text: ordered ? `%${level + 1}.` : '•', start: level === 0 ? start : 1,
      alignment: AlignmentType.START,
      style: { run: { font: design.font, color: design.corporate ? design.accent : design.body }, paragraph: { indent: { left: 360 * (level + 1), hanging: 260 } } },
    })) })) },
    styles: {
      default: { document: { run: { font: design.font, size: design.bodySize, color: design.body }, paragraph: { spacing: { line: design.line, after: design.paragraphAfter } } } },
      paragraphStyles: [
        { id: 'SofLIALogo', name: 'SofLIA Logo', basedOn: 'Normal', next: 'Normal', paragraph: { alignment: AlignmentType.CENTER, keepNext: true } },
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: design.font, size: design.titleSize, bold: true, color: design.heading }, paragraph: { spacing: { after: 220 }, keepNext: true } },
        { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', run: { font: design.font, size: 26, color: design.corporate ? DOCUMENT_COLORS.muted : design.heading } },
        { id: 'SofLIAMetadata', name: 'SofLIA Metadata', basedOn: 'Normal', run: { font: design.font, size: 18, color: DOCUMENT_COLORS.muted } },
        ...design.headingSizes.map((size, index) => ({ id: `Heading${index + 1}`, name: `heading ${index + 1}`, basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: design.font, size, bold: true, color: index === 0 ? design.heading : design.corporate ? design.secondary : design.heading }, paragraph: { spacing: { before: index === 0 ? 360 : 280, after: 140 }, keepNext: true, keepLines: true, outlineLevel: index } })),
      ],
    },
    sections: [{
      properties: { titlePage: cover && !design.corporate, page: { size: { width: design.page.width, height: design.page.height }, margin: { top: design.page.margin + (design.corporate ? 480 : 0), bottom: design.page.margin, left: design.page.margin, right: design.page.margin, header: design.corporate ? 430 : 650, footer: design.corporate ? 430 : 650 } } },
      headers: { default: documentHeader(title, design), ...(cover && !design.corporate ? { first: new Header({ children: [] }) } : {}) },
      footers: { default: documentFooter(design), ...(cover && !design.corporate ? { first: new Footer({ children: [] }) } : {}) },
      children,
    }],
  });
}
