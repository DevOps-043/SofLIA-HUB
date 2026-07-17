import type React from 'react';
import { CodeBlock } from './CodeBlock';
import { formatInline } from './inline-format';
import { QuoteBlock } from './QuoteBlock';
import { TableBlock } from './TableBlock';

const HEADER_CLASSES = {
  1: 'text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white',
  2: 'text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white',
  3: 'text-lg font-semibold mt-4 mb-2 text-primary/90 dark:text-gray-100',
  4: 'text-base font-semibold mt-3 mb-2 text-primary/80 dark:text-gray-200',
  5: 'text-sm font-semibold mt-2 mb-1 uppercase tracking-wide text-gray-500',
  6: 'text-xs font-semibold mt-2 mb-1 uppercase text-gray-500',
};

export function readNextBlock(
  lines: string[],
  index: number,
): { element: React.ReactNode; nextIndex: number } | null {
  const line = lines[index];
  if (line.startsWith('```')) return readCodeBlock(lines, index);
  if (line.trim().startsWith('|')) return readTableBlock(lines, index);
  if (line.trimStart().startsWith('>')) return readQuoteBlock(lines, index);
  if (line.startsWith('#')) return readHeaderBlock(line, index);
  if (line.trim() === '---' || line.trim() === '***') {
    return { element: <hr key={`hr-${index}`} className="my-6 border-gray-200 dark:border-white/10" />, nextIndex: index + 1 };
  }
  if (line.trim() === '') {
    return { element: <div key={`br-${index}`} className="h-2" />, nextIndex: index + 1 };
  }
  return readListBlock(line, index);
}

function readCodeBlock(lines: string[], index: number) {
  const language = lines[index].slice(3).trim();
  let codeContent = '';
  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex].startsWith('```')) {
    codeContent += (codeContent ? '\n' : '') + lines[nextIndex];
    nextIndex++;
  }
  return { element: <CodeBlock key={`code-${nextIndex}`} language={language} code={codeContent} />, nextIndex: nextIndex + 1 };
}

function readTableBlock(lines: string[], index: number) {
  const tableRows: string[] = [];
  let nextIndex = index;
  while (nextIndex < lines.length && lines[nextIndex].trim().startsWith('|')) {
    tableRows.push(lines[nextIndex]);
    nextIndex++;
  }
  return { element: <TableBlock key={`table-${nextIndex}`} rows={tableRows} />, nextIndex };
}

function readQuoteBlock(lines: string[], index: number) {
  // Consume tambien las lineas de '>' solo (separador de parrafos dentro de la cita)
  // para que un prompt citado se renderice como un solo bloque y no aparezcan '>' literales.
  const quoteContent: string[] = [];
  let nextIndex = index;
  while (nextIndex < lines.length && lines[nextIndex].trimStart().startsWith('>')) {
    quoteContent.push(lines[nextIndex].trimStart().replace(/^>\s?/, ''));
    nextIndex++;
  }

  const trimmedContent = trimEmptyEdges(quoteContent);
  return {
    element: (
      <QuoteBlock key={`quote-${nextIndex}`} rawText={trimmedContent.filter((quote) => quote.trim() !== '').join('\n')}>
        {trimmedContent.map((quote, quoteIndex) => (
          quote.trim() === ''
            ? <div key={quoteIndex} className="h-2" />
            : <p key={quoteIndex} className="my-1 leading-relaxed">{formatInline(quote)}</p>
        ))}
      </QuoteBlock>
    ),
    nextIndex,
  };
}

function trimEmptyEdges(content: string[]): string[] {
  let start = 0;
  let end = content.length;
  while (start < end && content[start].trim() === '') start++;
  while (end > start && content[end - 1].trim() === '') end--;
  return content.slice(start, end);
}

// Los encabezados se limpian de emojis para mantener un aspecto profesional,
// incluso en conversaciones guardadas antes de la regla de estilo del prompt.
function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function readHeaderBlock(line: string, index: number) {
  const level = line.match(/^#+/)?.[0].length || 0;
  const content = stripEmojis(line.slice(level).trim());
  const className = HEADER_CLASSES[level as keyof typeof HEADER_CLASSES] || HEADER_CLASSES[6];
  return { element: <div key={`h-${index}`} className={className}>{formatInline(content)}</div>, nextIndex: index + 1 };
}

function readListBlock(line: string, index: number) {
  const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
  if (!listMatch) return null;

  const indent = listMatch[1].length;
  const isOrdered = /^\d+\./.test(listMatch[2]);
  const content = line.replace(/^(\s*)([-*]|\d+\.)\s/, '');
  return {
    element: (
      <div key={`list-${index}`} className="flex gap-2 my-1" style={{ marginLeft: `${indent * 0.5}rem` }}>
        <span className={`flex-shrink-0 ${isOrdered ? 'text-accent font-medium text-xs mt-[3px]' : 'text-accent mt-1.5'}`}>
          {isOrdered ? listMatch[2] : '\u2022'}
        </span>
        <span className="leading-relaxed">{formatInline(content)}</span>
      </div>
    ),
    nextIndex: index + 1,
  };
}
