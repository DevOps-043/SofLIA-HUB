import { Paragraph, type Table } from 'docx';
import type { DocumentDesign } from '../../src/shared/document-design';
import { buildParagraph } from './block-builders';
import type { DocumentBlock } from './content-model';
import { buildTable } from './table-parser';

/** Configuración de cada lista independiente, conservando su primer ordinal. */
export function documentListStarts(blocks: DocumentBlock[]): Record<number, number> {
  const starts: Record<number, number> = {}; let instance = 0; let previousList = false;
  for (const block of blocks) {
    if (block.kind === 'list' && !previousList) instance++;
    if (block.kind === 'list' && block.ordered && starts[instance] === undefined) starts[instance] = block.start;
    previousList = block.kind === 'list';
  }
  return starts;
}
export function blocksToParagraphs(blocks: DocumentBlock[], design: DocumentDesign): (Paragraph | Table)[] {
  const result: (Paragraph | Table)[] = []; let instance = 0; let previousList = false; let keepList = false;
  for (const [index, block] of blocks.entries()) {
    if (block.kind === 'table') {
      result.push(new Paragraph({ spacing: { before: 60, after: 60 }, keepNext: true }), buildTable(block, design), new Paragraph({ spacing: { before: 0, after: 120 } }));
    } else {
      if (block.kind === 'list' && !previousList) {
        instance++;
        const group: DocumentBlock[] = [];
        for (let next = index; next < blocks.length && blocks[next].kind === 'list'; next++) group.push(blocks[next]);
        keepList = group.length <= 6 && group.reduce((total, item) => total + ('text' in item ? item.text.length : 0), 0) <= 800;
      }
      result.push(buildParagraph(block, design, instance, keepList && block.kind === 'list' && blocks[index + 1]?.kind === 'list'));
    }
    previousList = block.kind === 'list';
  }
  return result;
}
