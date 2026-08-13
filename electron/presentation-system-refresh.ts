import { DECK_BASE_CSS } from './organization-branding/deck-base-css';
import { DECK_BASE_JS } from './organization-branding/deck-base-js';
import type { SkillWorkspaceService } from './skill-workspace/service';

/**
 * Pone al dia los archivos protegidos que no dependen de la organizacion.
 *
 * Los workspaces son persistentes y nacen con una copia del motor. Si esa
 * copia no se refresca, una baraja antigua conserva para siempre defectos de
 * maquetacion ya corregidos en la aplicacion. La marca no se toca aqui porque
 * depende de la organizacion y de sus recursos descargados.
 *
 * El refresco es idempotente y silencioso: no modifica `updatedAt` ni emite
 * progreso, por lo que no crea un ciclo de recarga en el panel.
 */
export async function refreshPresentationSystem(
  service: SkillWorkspaceService,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(workspaceId ?? '').trim();
  if (!id) return { ok: false, error: 'El espacio de trabajo indicado no es valido.' };

  const base = await service.refreshSystemFile(id, 'estilos/base.css', DECK_BASE_CSS);
  if (!base.ok) return { ok: false, error: base.error };

  const guion = await service.refreshSystemFile(id, 'guion-base.js', DECK_BASE_JS);
  if (!guion.ok) return { ok: false, error: guion.error };

  return { ok: true };
}
