import type React from 'react';

function formatLink(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
    if (!match) {
      parts.push(<span key={`lr-${baseKey}-${key++}`}>{remaining}</span>);
      break;
    }

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
      </a>,
    );
    remaining = match[4];
  }

  return <>{parts}</>;
}

export function formatInline(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<strong key={`b-${key++}`} className="font-semibold text-gray-900 dark:text-gray-100">{formatLink(match[2], key++)}</strong>);
      remaining = match[3];
      continue;
    }

    match = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<em key={`i-${key++}`} className="italic text-gray-700 dark:text-gray-300">{formatLink(match[2], key++)}</em>);
      remaining = match[3];
      continue;
    }

    match = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(
        <code key={`c-${key++}`} className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-accent text-[13px] font-mono mx-0.5">
          {match[2]}
        </code>,
      );
      remaining = match[3];
      continue;
    }

    parts.push(formatLink(remaining, key++));
    break;
  }

  if (parts.length === 1) return parts[0];
  return <>{parts.map((part, index) => typeof part === 'string' ? <span key={`fi-${index}`}>{part}</span> : part)}</>;
}
