import { filmSchema } from '../../src/shared/audiovisual/film-schema';
import { filmFrameSvg } from '../../src/shared/audiovisual/frame';
import type { SkillWorkspaceService } from '../skill-workspace/service';

export async function prepareFilmPreview(service: SkillWorkspaceService, id: string): Promise<void> {
  const source = await service.readFile(id, 'film.json'); if (!source.ok) throw new Error(source.error);
  const film = filmSchema.parse(JSON.parse(source.data));
  const state = await service.getState(id);
  const payload = JSON.stringify(film).replace(/</g, '\\u003c');
  const body = state.ok && state.data.ready ? '<video controls autoplay src="salida/video.mp4"></video>' : `<div id="frame"></div><script>const film=${payload};const draw=${filmFrameSvg.toString()};const start=performance.now();function tick(now){document.getElementById('frame').innerHTML=draw(film,Math.floor((now-start)/1000*film.fps)%film.fotogramas);requestAnimationFrame(tick)}requestAnimationFrame(tick);</script>`;
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Vista audiovisual</title><style>body{margin:0;background:#071119;display:grid;place-items:center;height:100vh}svg,video{display:block;width:100%;max-height:100vh}#frame{width:100%}</style>${body}</html>`;
  const result = await service.refreshSystemFile(id, 'vista.html', html); if (!result.ok) throw new Error(result.error);
}
