import {
  AlignmentType,
  Document as DocxDocument,
  Footer,
  Header,
  NumberFormat,
  PageNumber,
  Paragraph,
  Table,
  TextRun,
} from 'docx';
import { COLORS } from './colors';

export function buildDocument(title: string, children: (Paragraph | Table)[]): DocxDocument {
  return new DocxDocument({
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{
          level: 0,
          format: NumberFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 360, hanging: 260 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: COLORS.text },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      headers: { default: createHeader(title) },
      footers: { default: createFooter() },
      children,
    }],
  });
}

function createHeader(title: string): Header {
  return new Header({
    children: [new Paragraph({
      children: [new TextRun({ text: title, italics: true, size: 16, color: COLORS.muted, font: 'Calibri' })],
      alignment: AlignmentType.RIGHT,
    })],
  });
}

function createFooter(): Footer {
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: 'SofLIA — ', size: 16, color: COLORS.muted, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.muted, font: 'Calibri' }),
        new TextRun({ text: ' / ', size: 16, color: COLORS.muted }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.muted, font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
    })],
  });
}
