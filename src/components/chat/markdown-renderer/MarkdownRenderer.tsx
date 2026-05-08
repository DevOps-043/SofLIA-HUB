import type React from 'react';
import { formatInline } from './inline-format';
import { readNextBlock } from './block-readers';

export function MarkdownRenderer({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const block = readNextBlock(lines, index);
    if (block) {
      elements.push(block.element);
      index = block.nextIndex;
      continue;
    }

    elements.push(<p key={`p-${index}`} className="my-1 leading-relaxed text-gray-800 dark:text-gray-300">{formatInline(line)}</p>);
    index++;
  }

  return <div className="space-y-1">{elements}</div>;
}
