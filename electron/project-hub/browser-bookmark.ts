import { z } from 'zod';
import { safeWebUrl } from '../../src/services/project-web-url';

const bookmark = z.object({
  workspaceId: z.string().uuid(), projectId: z.string().uuid(),
  evidence: z.object({
    type: z.literal('link'), source_system: z.literal('soflia-browser'),
    title: z.string().trim().min(1).max(500), external_reference: z.string().max(500),
    metadata: z.object({ url: z.string().max(4000), saved_from: z.literal('browser') }).strict(),
    items: z.array(z.never()).length(0),
  }).strict(),
}).strict();

/** Guardar un marcador es una acción explícita del usuario, sin textos ni adjuntos. */
export function isExplicitBrowserBookmark(input: unknown): boolean {
  const parsed = bookmark.safeParse(input);
  if (!parsed.success) return false;
  const { evidence } = parsed.data;
  const safe = safeWebUrl(evidence.metadata.url);
  return !!safe && safe === evidence.metadata.url && evidence.external_reference === safe.slice(0, 500);
}
