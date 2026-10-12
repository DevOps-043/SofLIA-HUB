import { documentReadingStyles } from '../../src/shared/document-presentation';
import { DOCUMENT_PAGE, resolveDocumentDesign } from '../../src/shared/document-design';
import { tableAlignment, tableColumnWidths, type DocumentBlock } from './content-model';
import { documentBlocks, shouldIncludeCover } from './document-layout';
import { parseInline } from './inline-parser';
import type { DocumentOptions } from './types';

export const escapeDocumentHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
function inline(text: string): string {
  return parseInline(text).map(part => {
    let value = escapeDocumentHtml(part.text);
    if (part.code) value = `<code>${value}</code>`;
    if (part.bold) value = `<strong>${value}</strong>`;
    if (part.italic) value = `<em>${value}</em>`;
    return part.href ? `<a href="${escapeDocumentHtml(part.href)}">${value}</a>` : value;
  }).join('');
}
function renderList(items: Extract<DocumentBlock, { kind: 'list' }>[]): string {
  let index = 0;
  const level = (depth: number): string => {
    let output = '';
    while (index < items.length && items[index].level >= depth) {
      const ordered = items[index].ordered; const tag = ordered ? 'ol' : 'ul';
      output += `<${tag}${ordered ? ` start="${items[index].start}"` : ''}>`;
      while (index < items.length && items[index].level >= depth && items[index].ordered === ordered) {
        const item = items[index++];
        output += `<li${ordered ? ` value="${item.start}"` : ''}>${inline(item.text)}`;
        if (index < items.length && items[index].level > depth) output += level(items[index].level);
        output += '</li>';
      }
      output += `</${tag}>`;
    }
    return output;
  };
  return level(items[0]?.level ?? 0);
}
export function renderDocumentBlocks(blocks: DocumentBlock[]): string {
  let output = ''; let index = 0;
  while (index < blocks.length) {
    const block = blocks[index++];
    switch (block.kind) {
      case 'heading': output += `<h${block.level}>${inline(block.text)}</h${block.level}>`; break;
      case 'paragraph': output += `<p>${inline(block.text)}</p>`; break;
      case 'quote': output += `<blockquote><p>${inline(block.text)}</p></blockquote>`; break;
      case 'rule': output += '<hr>'; break;
      case 'code': output += `<pre><code>${escapeDocumentHtml(block.text)}</code></pre>`; break;
      case 'list': {
        const items = [block];
        while (index < blocks.length && blocks[index].kind === 'list') items.push(blocks[index++] as typeof block);
        output += renderList(items); break;
      }
      case 'table': {
        const widths = tableColumnWidths(block.headers, block.rows, DOCUMENT_PAGE.contentWidth);
        output += '<table><colgroup>' + widths.map(width => `<col style="width:${width / DOCUMENT_PAGE.contentWidth * 100}%">`).join('') + '</colgroup><thead><tr>' + block.headers.map((value, column) => `<th style="text-align:${tableAlignment(block, column)}">${inline(value)}</th>`).join('') + '</tr></thead><tbody>';
        output += block.rows.map(row => '<tr>' + block.headers.map((_, column) => `<td style="text-align:${tableAlignment(block, column)}">${inline(row[column] ?? '')}</td>`).join('') + '</tr>').join('');
        output += '</tbody></table>'; break;
      }
    }
  }
  return output;
}
export function buildDocumentHtml(options: Pick<DocumentOptions, 'title' | 'subtitle' | 'author' | 'content' | 'design' | 'includeCover'>): string {
  const design = resolveDocumentDesign(options.design);
  const cover = shouldIncludeCover(options.content, options.includeCover);
  const metadata = [options.author ?? 'SofLIA', new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })].join(' · ');
  const title = `<header${cover ? ' class="document-cover"' : ''}><h1 class="document-title">${escapeDocumentHtml(options.title)}</h1>${options.subtitle ? `<p class="document-subtitle">${escapeDocumentHtml(options.subtitle)}</p>` : ''}<p class="document-meta">${escapeDocumentHtml(metadata)}</p></header>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeDocumentHtml(options.title)}</title><style>${documentReadingStyles(design)}</style></head><body><main class="document">${title}${renderDocumentBlocks(documentBlocks(options.title, options.content))}</main></body></html>`;
}
