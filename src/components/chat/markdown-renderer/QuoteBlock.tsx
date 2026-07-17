import { useState } from 'react';
import type React from 'react';

export function QuoteBlock({ rawText, children }: { rawText: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <blockquote className="border-l-4 border-accent bg-gray-50 dark:bg-white/5 rounded-r-lg py-3 pl-4 pr-12 text-gray-700 dark:text-gray-300">
        {children}
      </blockquote>
      <button
        onClick={handleCopy}
        title={copied ? 'Copiado' : 'Copiar'}
        aria-label={copied ? 'Copiado' : 'Copiar cita'}
        className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        )}
      </button>
    </div>
  );
}
