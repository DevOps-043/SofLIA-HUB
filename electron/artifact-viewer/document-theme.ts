import { z } from 'zod';
import { documentDesignSchema, resolveDocumentDesign } from '../../src/shared/document-design';
import { documentReadingStyles } from '../../src/shared/document-presentation';
import { readOfficePart } from './office-limits';
import { normalizeDocumentLogo } from '../organization-branding/document-logo';
import { escapeDocumentHtml } from '../document-designer/html-document';

const themeSchema = z.object({ design: documentDesignSchema, cover: z.boolean(), organizationName: z.string().max(200).optional(), logoPart: z.string().regex(/^word\/media\/[a-f0-9]{40}\.png$/).optional() }).strict();

/** Solo datos declarativos del tema; nada del XML se convierte en CSS ejecutable. */
export async function applyDocumentTheme(buffer: Buffer, html: string): Promise<string> {
  const xml = readOfficePart(buffer, 'docProps/custom.xml', 16_384)?.toString('utf8');
  if (!xml) return html;
  const property = [...xml.matchAll(/<property\b([^>]*)>([\s\S]*?)<\/property>/g)].find(match => /\bname="SofLIA\.DocumentTheme"/.test(match[1]));
  const value = property?.[2].match(/<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>/)?.[1];
  if (!value || value.length > 8000) return html;
  let parsed: unknown;
  try { parsed = JSON.parse(value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); } catch { return html; }
  const validated = themeSchema.safeParse(parsed);
  if (!validated.success) return html;
  const theme = validated.data;
  const design = resolveDocumentDesign(theme.design);
  let logo = '';
  const bytes = theme.logoPart ? readOfficePart(buffer, theme.logoPart, 65_536) : null;
  if (bytes) {
    try {
      const normalized = await normalizeDocumentLogo(bytes);
      logo = `<img alt="Logo de la organización" src="data:image/png;base64,${Buffer.from(normalized.png).toString('base64')}">`;
    } catch { /* Un logo inválido no elimina el contenido del documento. */ }
  }
  const header = `<div class="document-running-header">${logo || escapeDocumentHtml(theme.organizationName ?? 'SofLIA')}</div>`;
  let content = html;
  const coverEnd = html.indexOf('</table>');
  if (theme.cover && coverEnd >= 0) {
    content = '<header class="document-cover">' + html.slice(0, coverEnd + 8).replace('<table>', '<table class="document-metadata">') + '</header>' + html.slice(coverEnd + 8);
  }
  return `<style>${documentReadingStyles(design)}</style>${header}${content}`;
}
