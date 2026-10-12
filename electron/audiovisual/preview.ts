import { filmSchema } from '../../src/shared/audiovisual/film-schema';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import { filmDocument } from './document';

export async function prepareFilmPreview(service: SkillWorkspaceService, id: string, root = process.env.APP_ROOT ?? process.cwd()): Promise<void> {
  const source = await service.readFile(id, 'film.json'); if (!source.ok) throw new Error(source.error);
  const film = filmSchema.parse(JSON.parse(source.data)), state = await service.getState(id);
  const html = state.ok && state.data.ready
    ? '<!doctype html><html lang="es"><meta charset="utf-8"><title>Video audiovisual</title><style>body{margin:0;background:#071119;display:grid;place-items:center;height:100vh}video{display:block;width:100%;max-height:100vh}</style><video controls autoplay playsinline preload="metadata" src="salida/video.mp4"></video></html>'
    : await filmDocument(film, root);
  const result = await service.refreshSystemFile(id, 'vista.html', html); if (!result.ok) throw new Error(result.error);
}
