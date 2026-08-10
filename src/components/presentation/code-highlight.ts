import hljs from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';

/**
 * Resaltado del codigo que escribe la Skill.
 *
 * Se registran SOLO los lenguajes que una presentacion puede contener. El
 * paquete completo de highlight.js trae casi 200 gramaticas y ninguna otra se
 * usa aqui.
 */
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);

/**
 * Cota de resaltado. El contenido lo escribe un modelo y las gramaticas son
 * expresiones regulares: un archivo muy grande podria congelar el renderer
 * mientras se tokeniza. Por encima de este tamano se muestra sin colores, que
 * es peor esteticamente pero no bloquea la interfaz.
 */
const MAX_HIGHLIGHT_CHARS = 120_000;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  css: 'css',
  md: 'markdown',
};

export function languageForPath(filePath: string): string | null {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXTENSION[extension] ?? null;
}

/**
 * Devuelve HTML resaltado, o `null` cuando no procede resaltar (lenguaje
 * desconocido, archivo demasiado grande o fallo de la gramatica). El llamador
 * pinta texto plano en ese caso.
 */
export function highlightCode(filePath: string, code: string): string | null {
  const language = languageForPath(filePath);
  if (!language || code.length > MAX_HIGHLIGHT_CHARS) return null;

  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}
