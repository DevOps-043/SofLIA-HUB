import path from 'node:path';
import type { Cell, Column } from 'exceljs';
import type { DocumentBaseArgs } from './types';

export async function createExcelDocument(args: DocumentBaseArgs): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet(args.title.slice(0, 31));
  const rows = parseRows(args.content);

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of rows) sheet.addRow(headers.map((header) => row[header] ?? ''));
    autoFitColumns(sheet.columns);
  }

  const filePath = path.join(args.saveDir, `${args.filename}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

function parseRows(content: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ Contenido: line }));
  }
}

function autoFitColumns(columns: Partial<Column>[]): void {
  for (const column of columns) {
    let maxLen = 10;
    column.eachCell?.({ includeEmpty: false }, (cell: Cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(maxLen + 2, 50);
  }
}
