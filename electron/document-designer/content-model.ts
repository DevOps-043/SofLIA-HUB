export type TableAlignment = 'left' | 'center' | 'right' | 'auto';
export type DocumentBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph' | 'quote'; text: string }
  | { kind: 'list'; text: string; ordered: boolean; level: number; start: number }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; headers: string[]; rows: string[][]; alignments: TableAlignment[] };

/** Respeta celdas vacías y barras escapadas; un campo vacío no desplaza sus vecinos. */
export function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (/(?<!\\)\|$/.test(text)) text = text.slice(0, -1);
  const cells: string[] = []; let value = ''; let code = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '|') { value += '|'; index++; }
    else if (char === '`') { code = !code; value += char; }
    else if (char === '|' && !code) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim()); return cells;
}
function isTableSeparator(line: string): boolean {
  return line.includes('|') && splitTableRow(line).every(cell => /^:?-{3,}:?$/.test(cell));
}
function startsBlock(line: string, next = ''): boolean {
  return /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|~~~)/.test(line.trim()) || /^[-*_]{3,}$/.test(line.trim()) || (line.includes('|') && isTableSeparator(next));
}
export function parseDocumentContent(content: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = []; const lines = content.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]; const trimmed = line.trim();
    if (!trimmed) { index++; continue; }
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      const values: string[] = []; index++;
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) values.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({ kind: 'code', text: values.join('\n') }); continue;
    }
    if (trimmed.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
      const headers = splitTableRow(trimmed); const separators = splitTableRow(lines[index + 1]);
      const alignments = headers.map((_, column): TableAlignment => separators[column]?.endsWith(':') ? (separators[column].startsWith(':') ? 'center' : 'right') : separators[column]?.startsWith(':') ? 'left' : 'auto');
      const rows: string[][] = []; index += 2;
      while (index < lines.length && lines[index].trim().includes('|') && lines[index].trim()) rows.push(splitTableRow(lines[index++]));
      const columns = Math.max(headers.length, ...rows.map(row => row.length));
      if (columns > 20) throw new Error('La tabla supera el límite de 20 columnas legibles. Divide los campos en tablas relacionadas.');
      while (headers.length < columns) { headers.push(''); alignments.push('left'); }
      blocks.push({ kind: 'table', headers, rows, alignments }); continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (heading) { blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] }); index++; continue; }
    if (/^[-*_]{3,}$/.test(trimmed)) { blocks.push({ kind: 'rule' }); index++; continue; }
    const list = line.match(/^(\s*)(?:([-*+•])|(\d+)[.)])\s+(.+)$/);
    if (list) {
      const level = Math.min(8, Math.floor(list[1].replace(/\t/g, '    ').length / 2));
      let text = list[4]; index++;
      while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !startsBlock(lines[index])) text += ' ' + lines[index++].trim();
      blocks.push({ kind: 'list', text, ordered: Boolean(list[3]), level, start: Number(list[3] ?? 1) }); continue;
    }
    if (/^>/.test(trimmed)) {
      const values: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) values.push(lines[index++].trim().replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: values.join(' ') }); continue;
    }
    const values = [trimmed]; index++;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index], lines[index + 1])) values.push(lines[index++].trim());
    blocks.push({ kind: 'paragraph', text: values.join(' ') });
  }
  return blocks;
}

export function tableColumnWidths(headers: string[], rows: string[][], total: number): number[] {
  const weights = headers.map((heading, column) => {
    const values = [heading, ...rows.map(row => row[column] ?? '')];
    const longest = Math.min(90, Math.max(6, ...values.map(value => value.length)));
    return Math.sqrt(longest);
  });
  const sum = weights.reduce((value, weight) => value + weight, 0);
  const widths = weights.map(weight => Math.floor(total * weight / sum));
  widths[widths.length - 1] += total - widths.reduce((value, width) => value + width, 0);
  return widths;
}
export function tableAlignment(block: Extract<DocumentBlock, { kind: 'table' }>, column: number): Exclude<TableAlignment, 'auto'> {
  const preference = block.alignments[column];
  if (preference && preference !== 'auto') return preference;
  const values = block.rows.map(row => (row[column] ?? '').trim()).filter(Boolean);
  return values.length && values.every(value => value.length <= 16 && /^(?:[-+]?\d[\d\s.,/%:-]*|pendiente|listo|completado|sí|no)$/i.test(value)) ? 'center' : 'left';
}
