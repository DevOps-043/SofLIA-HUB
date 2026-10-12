import { parseDocumentContent } from './content-model';
import { parseInline } from './inline-parser';

export function documentBlocks(title: string, content: string) {
  const blocks = parseDocumentContent(content);
  const first = blocks[0];
  const normalized = (value: string) => parseInline(value).map(part => part.text).join('').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  if (first?.kind === 'heading' && first.level === 1 && normalized(first.text) === normalized(title)) blocks.shift();
  return blocks;
}
/** Solo los informes extensos usan portada automática; una decisión explícita prevalece. */
export function shouldIncludeCover(content: string, preference?: boolean): boolean {
  return preference ?? content.trim().length >= 6000;
}
