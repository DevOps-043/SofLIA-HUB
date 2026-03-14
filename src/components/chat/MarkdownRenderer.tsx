import React, { useState } from 'react';

// ============================================
// Advanced Markdown Renderer
// ============================================

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden bg-[#1E1E1E] border border-white/10 shadow-sm relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs text-gray-400 uppercase font-mono">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-accent font-medium">Copiado</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <code className="text-[13px] leading-relaxed font-mono text-gray-200 block min-w-full whitespace-pre font-ligatures-none">{code}</code>
      </div>
    </div>
  );
};

const TableBlock: React.FC<{ rows: string[] }> = ({ rows }) => {
  if (rows.length < 2) return null;

  const headerCells = rows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
  const bodyRows = rows.slice(2).map(r => r.split('|').filter(c => c.trim() !== '').map(c => c.trim()));

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200">
          <tr>
            {headerCells.map((h, idx) => (
              <th key={idx} className="px-4 py-3 font-semibold border-b border-gray-200 dark:border-white/10 whitespace-nowrap">
                {formatInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-[#1E1E1E] divide-y divide-gray-200 dark:divide-white/5">
          {bodyRows.map((r, rIdx) => (
            <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              {r.map((c, cIdx) => (
                <td key={cIdx} className="px-4 py-2.5 text-gray-700 dark:text-gray-400 border-r border-gray-200 dark:border-white/5 last:border-r-0">
                  {formatInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Helper to handle links [text](url)
function formatLink(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
    if (match) {
      if (match[1]) parts.push(<span key={`lt-${baseKey}-${key++}`}>{match[1]}</span>);
      parts.push(
        <a
          key={`l-${baseKey}-${key++}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline decoration-accent/50 underline-offset-2"
        >
          {match[2]}
        </a>
      );
      remaining = match[4];
      continue;
    }
    parts.push(<span key={`lr-${baseKey}-${key++}`}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

// Simple formatter for inline markdown
function formatInline(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<strong key={`b-${key++}`} className="font-semibold text-gray-900 dark:text-gray-100">{formatLink(match[2], key++)}</strong>);
      remaining = match[3];
      continue;
    }

    // Italic: *text*
    match = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<em key={`i-${key++}`} className="italic text-gray-700 dark:text-gray-300">{formatLink(match[2], key++)}</em>);
      remaining = match[3];
      continue;
    }

    // Code: `text`
    match = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(
        <code key={`c-${key++}`} className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-accent text-[13px] font-mono mx-0.5">
          {match[2]}
        </code>
      );
      remaining = match[3];
      continue;
    }

    parts.push(formatLink(remaining, key++));
    break;
  }

  if (parts.length === 1) return parts[0];
  return <>{parts.map((p, idx) => typeof p === 'string' ? <span key={`fi-${idx}`}>{p}</span> : p)}</>;
}

export const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Blocks
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeContent += (codeContent ? '\n' : '') + lines[i];
        i++;
      }
      elements.push(<CodeBlock key={`code-${i}`} language={language} code={codeContent} />);
      i++; // skip closing ```
      continue;
    }

    // 2. Tables
    if (line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      elements.push(<TableBlock key={`table-${i}`} rows={tableRows} />);
      continue;
    }

    // 3. Blockquotes
    if (line.startsWith('> ')) {
      const quoteContent: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteContent.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-accent bg-accent/5 py-2 px-4 my-4 rounded-r text-gray-600 dark:text-gray-400 italic">
          {quoteContent.map((q, idx) => <p key={idx} className="my-1">{formatInline(q)}</p>)}
        </blockquote>
      );
      continue;
    }

    // 4. Headers
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 0;
      const content = line.slice(level).trim();

      const sizes = {
        1: "text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white",
        2: "text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white",
        3: "text-lg font-semibold mt-4 mb-2 text-primary/90 dark:text-gray-100",
        4: "text-base font-semibold mt-3 mb-2 text-primary/80 dark:text-gray-200",
        5: "text-sm font-semibold mt-2 mb-1 uppercase tracking-wide text-gray-500",
        6: "text-xs font-semibold mt-2 mb-1 uppercase text-gray-500"
      };

      const className = sizes[level as keyof typeof sizes] || sizes[6];
      elements.push(<div key={`h-${i}`} className={className}>{formatInline(content)}</div>);
      i++;
      continue;
    }

    // 5. Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="my-6 border-gray-200 dark:border-white/10" />);
      i++;
      continue;
    }

    // 6. Lists
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const isOrdered = /^\d+\./.test(listMatch[2]);
      const content = line.replace(/^(\s*)([-*]|\d+\.)\s/, '');

      elements.push(
        <div key={`list-${i}`} className="flex gap-2 my-1" style={{ marginLeft: `${indent * 0.5}rem` }}>
           <span className={`flex-shrink-0 ${isOrdered ? 'text-accent font-medium text-xs mt-[3px]' : 'text-accent mt-1.5'}`}>
             {isOrdered ? listMatch[2] : '•'}
           </span>
           <span className="leading-relaxed">{formatInline(content)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Empty lines
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 8. Paragraphs
    elements.push(<p key={`p-${i}`} className="my-1 leading-relaxed text-gray-800 dark:text-gray-300">{formatInline(line)}</p>);
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

export const UserAvatar = ({ src, fallback }: { src?: string | null, fallback: React.ReactNode }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt="User"
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};
