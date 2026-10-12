import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SkillWorkspaceService } from '../electron/skill-workspace/service';
import { AUDIOVISUAL_SKILL } from '../src/shared/skills/audiovisual-skill';
import { PRESENTACIONES_SKILL } from '../src/shared/skills/presentaciones-skill';
import { AudiovisualService } from '../electron/audiovisual/service';
import { exportPresentationDeckToHtml } from '../electron/skill-workspace/export-html';
import { exportWorkspacePptx } from '../electron/presentation-export/pptx';
import { prepareFilmPreview } from '../electron/audiovisual/preview';
import { createFilmRenderer } from '../electron/audiovisual/browser-renderer';
import { filmSchema } from '../src/shared/audiovisual/film-schema';
import { masterAudio } from '../electron/audiovisual/master-audio';
import { resolveMediaRuntime } from '../electron/audiovisual/runtime';

app.on('window-all-closed', () => undefined);
void app.whenReady().then(async () => {
  const root = process.env.SOFLIA_SMOKE_ROOT!, output = process.env.SOFLIA_SMOKE_OUTPUT!;
  const filmPath = process.env.SOFLIA_SMOKE_FILM || path.join(root, process.env.SOFLIA_SMOKE_CINEMATIC ? 'test/fixtures/audiovisual-cinematic.json' : 'test/fixtures/audiovisual-film.json');
  if (process.env.SOFLIA_SMOKE_AUDIO) {
    const film = filmSchema.parse(JSON.parse(await fs.readFile(filmPath, 'utf8')));
    const controller = new AbortController(), capture = await createFilmRenderer(film, root, output, controller.signal);
    try {
      const audio = await capture.audio(), again = await capture.audio();
      let maxDelta = 0;
      for (let i = 44; i < audio.pcm.length; i += 3) maxDelta = Math.max(maxDelta, Math.abs(audio.pcm.readIntLE(i, 3) - again.pcm.readIntLE(i, 3)) / 8388607);
      if (maxDelta > .0001) throw new Error('La síntesis cambia entre ejecuciones: ' + maxDelta);
      const source = path.join(output, 'score.wav'), target = path.join(output, 'score.m4a');
      await fs.writeFile(source, audio.pcm);
      const runtime = await resolveMediaRuntime(root);
      const levels = await masterAudio(runtime.ffmpeg, source, target, false, controller.signal);
      await fs.writeFile(path.join(output, 'audio.json'), JSON.stringify({ ...audio.report, levels, deltaMaximo: maxDelta }, null, 2));
      console.info(JSON.stringify({ ...audio.report, levels, deltaMaximo: maxDelta }));
    } finally { capture.close(); }
    app.exit(0); return;
  }
  const service = new SkillWorkspaceService(path.join(output, 'workspaces'));
  const presentation = await service.createWorkspace({ skillId: PRESENTACIONES_SKILL.id, title: 'Presentación semántica', policy: PRESENTACIONES_SKILL.workspace! }); if (!presentation.ok) throw new Error(presentation.error);
  const p = presentation.data.id;
  const written = await service.writeFile(p, 'deck.json', await fs.readFile(path.join(root, process.env.SOFLIA_SMOKE_CINEMATIC ? 'test/fixtures/production-art-direction-deck.json' : 'test/fixtures/production-deck.json'), 'utf8')); if (!written.ok) throw new Error(written.error);
  const html = await exportPresentationDeckToHtml(service, p, path.join(root, 'dist')); if (!html.ok) throw new Error(html.error);
  await exportWorkspacePptx(service, p);
  if (process.env.SOFLIA_SMOKE_DECK) {
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ html: html.htmlPath, pptx: await service.resolveAbsolutePath(p, 'salida/presentacion.pptx') }, null, 2));
    app.exit(0); return;
  }
  const audiovisual = await service.createWorkspace({ skillId: AUDIOVISUAL_SKILL.id, title: 'SofLIA del conocimiento a la acción', policy: AUDIOVISUAL_SKILL.workspace! }); if (!audiovisual.ok) throw new Error(audiovisual.error);
  const id = audiovisual.data.id;
  const film = await service.writeFile(id, 'film.json', await fs.readFile(filmPath, 'utf8')); if (!film.ok) throw new Error(film.error);
  const script = await service.writeFile(id, 'guion.md', 'Guion de prueba: manifiesto local seleccionado. Los mensajes y tiempos están en film.json.');
  if (!script.ok) throw new Error(script.error);
  await prepareFilmPreview(service, id, root);
  service.on('progreso', event => { if (event.message) console.info(event.message); });
  const renderer = new AudiovisualService(service, root);
  const inspection = await renderer.inspect(id);
  for (let i = 0; i < inspection.images.length; i++) await fs.writeFile(path.join(output, 'escenas-' + i + '.jpg'), Buffer.from(inspection.images[i].split(',')[1], 'base64'));
  await fs.writeFile(path.join(output, 'inspeccion.json'), JSON.stringify({ ...inspection, images: undefined }, null, 2));
  if (process.env.SOFLIA_SMOKE_INSPECT) { console.info(JSON.stringify({ id, ...inspection, images: undefined })); app.exit(0); return; }
  const result = await renderer.render(id);
  const state = await service.getState(id); if (!state.ok || !state.data.ready) throw new Error('El MP4 no quedó listo tras el render.');
  await prepareFilmPreview(service, id, root);
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ html: html.htmlPath, pptx: await service.resolveAbsolutePath(p, 'salida/presentacion.pptx'), video: await service.resolveAbsolutePath(id, result.path), qa: await service.resolveAbsolutePath(id, 'qa/informe.json'), ready: state.data.ready }, null, 2));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
