import type { ProjectSection } from './types';
import { HubGlyph } from '../ui/HubGlyph';

/** Adaptador de navegación del proyecto sobre el catálogo visual compartido. */
export function ProjectGlyph({ name, size = 20 }: { name: ProjectSection | 'browser' | 'folder' | 'back' | 'plus'; size?: number }) {
  return <HubGlyph name={name} size={size} className="project-glyph" data-motion={name === 'plus' ? 'plus' : undefined} />;
}
