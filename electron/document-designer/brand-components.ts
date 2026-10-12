import { AlignmentType, BorderStyle, Footer, Header, ImageRun, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopType, TextRun, WidthType } from 'docx';
import { DOCUMENT_COLORS, type DocumentDesign } from '../../src/shared/document-design';

export function brandLogo(design: DocumentDesign, width: number, height: number): ImageRun | null {
  const logo = design.logo;
  if (!logo) return null;
  const scale = Math.min(width / logo.width, height / logo.height, 1);
  return new ImageRun({ data: logo.png, type: 'png', transformation: { width: Math.round(logo.width * scale), height: Math.round(logo.height * scale) },
    altText: { title: design.organizationName ?? 'Logo', description: 'Logo de la organización', name: 'Logo' } });
}

/** Metadatos conocidos, sin inventar versión, clasificación ni responsables. */
export function corporateMetadata(design: DocumentDesign, author?: string): Table {
  const rows = [
    ...(design.organizationName ? [['Organización', design.organizationName]] : []),
    ['Fecha', new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Preparado por', author ?? 'SofLIA'],
  ];
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const widths = [Math.round(design.page.contentWidth * .3), Math.round(design.page.contentWidth * .7)];
  return new Table({ width: { type: WidthType.DXA, size: design.page.contentWidth }, layout: TableLayoutType.FIXED,
    columnWidths: [Math.round(design.page.contentWidth * .3), Math.round(design.page.contentWidth * .7)],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: rows.map((row, index) => new TableRow({ children: row.map((text, column) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, font: design.font, size: 20, color: column ? design.body : design.primary, bold: !column })], spacing: { after: 0, line: 264 } })],
      width: { type: WidthType.DXA, size: widths[column] },
      margins: { top: 150, bottom: 150, left: 180, right: 180 },
      shading: { fill: index % 2 ? 'FFFFFF' : design.stripe, color: 'auto', type: ShadingType.CLEAR },
      borders: { top: none, bottom: none, left: none, right: none },
    })) })),
  });
}

export function documentHeader(title: string, design: DocumentDesign): Header {
  const logo = design.corporate ? brandLogo(design, 88, 26) : null;
  const titleLimit = design.corporate ? 55 : 70;
  const titleText = title.length > titleLimit ? title.slice(0, titleLimit - 3) + '…' : title;
  const organization = design.organizationName ?? 'SofLIA';
  const organizationText = organization.length > 28 ? organization.slice(0, 25) + '…' : organization;
  return new Header({ children: [new Paragraph({
    children: [...(design.corporate ? [logo ?? new TextRun({ text: organizationText, font: design.font, size: 17, bold: true, color: design.primary }), new TextRun('\t')] : []),
      new TextRun({ text: titleText, font: design.font, size: 17, color: design.heading })],
    tabStops: [{ type: TabStopType.RIGHT, position: design.page.contentWidth }],
    alignment: design.corporate ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { after: 100 },
    ...(design.corporate ? { border: { bottom: { style: BorderStyle.SINGLE, color: design.accent, size: 6, space: 6 } } } : {}),
  })] });
}
export function documentFooter(design: DocumentDesign): Footer {
  const organization = design.organizationName ?? 'SofLIA';
  const label = organization.length > 60 ? organization.slice(0, 57) + '…' : organization;
  return new Footer({ children: [new Paragraph({ children: [
    new TextRun({ text: `${label}  ·  Página `, font: design.font, size: 17, color: DOCUMENT_COLORS.muted }),
    new TextRun({ children: [PageNumber.CURRENT], size: 17, color: DOCUMENT_COLORS.muted }),
    new TextRun({ text: ' de ', size: 17, color: DOCUMENT_COLORS.muted }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: DOCUMENT_COLORS.muted }),
  ], alignment: design.corporate ? AlignmentType.CENTER : AlignmentType.RIGHT, spacing: { after: 0 } })] });
}
