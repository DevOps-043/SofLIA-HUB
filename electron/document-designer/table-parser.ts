import { AlignmentType, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { COLORS } from './colors';
import { inlineToRuns, parseInline } from './inline-parser';

export function parseTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;

  const headerCells = lines[0].split('|').map((cell) => cell.trim()).filter(Boolean);
  const dataRows = lines.slice(2).map((row) =>
    row.split('|').map((cell) => cell.trim()).filter(Boolean),
  );

  if (headerCells.length === 0) return null;

  const colWidth = Math.floor(9000 / headerCells.length);
  const header = new TableRow({
    children: headerCells.map((cell) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: cell, bold: true, color: COLORS.tableHeaderText, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
        shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR, color: 'auto' },
        width: { size: colWidth, type: WidthType.DXA },
      }),
    ),
    tableHeader: true,
  });

  const rows = dataRows.map((row, rowIdx) =>
    new TableRow({
      children: headerCells.map((_, colIdx) =>
        new TableCell({
          children: [new Paragraph({
            children: inlineToRuns(parseInline(row[colIdx] || ''), 20),
            spacing: { before: 40, after: 40 },
          })],
          shading: rowIdx % 2 === 0
            ? { fill: COLORS.tableBg, type: ShadingType.CLEAR, color: 'auto' }
            : undefined,
          width: { size: colWidth, type: WidthType.DXA },
        }),
      ),
    }),
  );

  return new Table({
    rows: [header, ...rows],
    width: { size: 9000, type: WidthType.DXA },
  });
}
