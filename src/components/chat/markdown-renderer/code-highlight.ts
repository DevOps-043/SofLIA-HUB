import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dos from 'highlight.js/lib/languages/dos';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

// Instancia independiente del visor de presentaciones; solo se cargan las gramáticas admitidas.
const highlighter = hljs.newInstance();
for (const [name, grammar] of Object.entries({
  bash, css, diff, dos, java, javascript, json, powershell, python, sql, typescript, xml, yaml,
})) highlighter.registerLanguage(name, grammar);
highlighter.registerAliases(['cmd', 'batch'], { languageName: 'dos' });
highlighter.registerAliases(['ps', 'ps1', 'pwsh'], { languageName: 'powershell' });
highlighter.registerAliases(['shell', 'zsh'], { languageName: 'bash' });

const MAX_HIGHLIGHT_CHARS = 120_000;

export function highlightChatCode(language: string, code: string): string | null {
  const normalizedLanguage = language.trim().toLowerCase().split(/\s+/)[0].replace(/^language-/, '');
  if (!highlighter.getLanguage(normalizedLanguage) || code.length > MAX_HIGHLIGHT_CHARS) return null;
  try {
    // El resaltador escapa el contenido original y solo genera spans de tokens.
    return highlighter.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}
