import { Paragraph, Table } from 'docx';
import { createCodeBlock, createHeading, createHorizontalRule, createListParagraph, createRegularParagraph } from './block-builders';
import { parseTable } from './table-parser';

export function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = content.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '') {
      index += 1;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(createHorizontalRule());
      index += 1;
      continue;
    }

    if (trimmed.includes('|') && index + 1 < lines.length && lines[index + 1].includes('---')) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const table = parseTable(tableLines);
      if (table) {
        elements.push(new Paragraph({ children: [], spacing: { before: 100 } }));
        elements.push(table);
        elements.push(new Paragraph({ children: [], spacing: { after: 100 } }));
      }
      continue;
    }

    const heading = createHeading(trimmed);
    if (heading) {
      elements.push(heading);
      index += 1;
      continue;
    }

    const listParagraph = createListParagraph(trimmed, line);
    if (listParagraph) {
      elements.push(listParagraph);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      elements.push(createCodeBlock(codeLines));
      continue;
    }

    elements.push(createRegularParagraph(trimmed));
    index += 1;
  }

  return elements;
}
