import { AlignmentType, BorderStyle, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, VerticalAlign, WidthType } from 'docx';
import { DOCUMENT_COLORS, documentHeaderText, type DocumentDesign } from '../../src/shared/document-design';
import { tableAlignment, tableColumnWidths, type DocumentBlock } from './content-model';
import { inlineToRuns, parseInline } from './inline-parser';

export function buildTable(block: Extract<DocumentBlock, { kind: 'table' }>, design: DocumentDesign): Table {
  const widths = tableColumnWidths(block.headers, block.rows, design.page.contentWidth);
  const border = { style: BorderStyle.SINGLE, size: 4, color: DOCUMENT_COLORS.border };
  const cells = (row: string[], header: boolean, rowIndex = 0) => block.headers.map((_, column) => new TableCell({
    children: [new Paragraph({
      children: inlineToRuns(parseInline(row[column] ?? '').map(part => header ? { ...part, bold: true } : part), 22, design, header ? documentHeaderText(design.tableFill) : design.body),
      alignment: tableAlignment(block, column) === 'right' ? AlignmentType.RIGHT : tableAlignment(block, column) === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 264 },
    })],
    width: { size: widths[column], type: WidthType.DXA },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: header ? design.tableFill : rowIndex % 2 === 0 ? design.stripe : 'FFFFFF', type: ShadingType.CLEAR, color: 'auto' },
    borders: { top: border, bottom: border, left: border, right: border },
  }));
  return new Table({
    rows: [new TableRow({ children: cells(block.headers, true), tableHeader: true }), ...block.rows.map((row, index) => new TableRow({ children: cells(row, false, index) }))],
    columnWidths: widths, layout: TableLayoutType.FIXED,
    width: { size: design.page.contentWidth, type: WidthType.DXA },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
  });
}
