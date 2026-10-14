import { useEffect, useRef, useState } from 'react';
import { studioCapture } from '../../../services/studio-capture';
import type { useStudioScenes, StudioSceneDraft } from './useStudioScenes';
import type { StudioMediaRuntime } from './StudioMediaContext';

export function useStudioSceneSharing(scenes: ReturnType<typeof useStudioScenes>, media: StudioMediaRuntime | null, designShare: () => void) {
  const [sceneError, setSceneError] = useState('');
  const [scenePending, setScenePending] = useState(false);
  const sceneBusy = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function selectScene(id: string) {
    if (sceneBusy.current) return;
    const scene = scenes.scenes.find((item) => item.id === id);
    if (!scene) return;
    if (scene.id === scenes.activeScene?.id) return;
    if (!media) { scenes.selectScene(id); return; }
    sceneBusy.current = true; setScenePending(true); setSceneError('');
    try {
      if (scene.capture) {
        if (media.screen) { if (!await media.shareBinding(scene.capture.id)) return; }
        else await studioCapture.activate(scene.capture.id);
      } else { await studioCapture.activate(null); media.stopScreen(); }
      if (!alive.current) return;
      if (media.zoomSharing) media.stopZoomShare();
      scenes.selectScene(id);
    } catch { if (alive.current) setSceneError('La fuente ligada ya no está disponible. Usa Cambiar fuente para vincular otra.'); }
    finally { sceneBusy.current = false; if (alive.current) setScenePending(false); }
  }
  function addScene(draft: StudioSceneDraft) {
    const error = scenes.addScene(draft);
    if (!error && !scenes.activeScene && draft.capture) void studioCapture.activate(draft.capture.id).catch(() => { if (alive.current) setSceneError('La escena se creó, pero su fuente se cerró. Vuelve a vincularla.'); });
    return error;
  }
  async function relinkScene(id: string) {
    if (sceneBusy.current) return;
    sceneBusy.current = true; setScenePending(true); setSceneError('');
    let binding: Awaited<ReturnType<typeof studioCapture.choose>> = null;
    try {
      binding = await studioCapture.choose();
      if (!binding) return;
      if (!alive.current) { await studioCapture.release(binding.id); return; }
      if (scenes.activeScene?.id === id) {
        if (media?.screen) { if (!await media.shareBinding(binding.id)) { await studioCapture.release(binding.id); return; } }
        else await studioCapture.activate(binding.id);
        if (media?.zoomSharing) media.stopZoomShare();
      }
      scenes.bindScene(id, binding);
    } catch { if (binding) void studioCapture.release(binding.id).catch(() => console.warn('[Estudio] No se pudo liberar la fuente de reemplazo.')); if (alive.current) setSceneError('No pudimos cambiar la fuente de esta escena. Vuelve a intentar.'); }
    finally { sceneBusy.current = false; if (alive.current) setScenePending(false); }
  }
  function removeScene(id: string) {
    if (sceneBusy.current) return;
    if (scenes.activeScene?.id === id && media) {
      media.stopScreen(); if (media.zoomSharing) media.stopZoomShare();
      const next = scenes.scenes.find((scene) => scene.id !== id)?.capture;
      void studioCapture.activate(next?.id ?? null).catch(() => { if (alive.current) setSceneError('La siguiente escena necesita volver a vincular su fuente.'); });
    }
    scenes.removeScene(id);
  }
  async function shareScene() {
    if (!media) { designShare(); return; }
    if (media.zoomSharing) { media.stopZoomShare(); return; }
    if (media.screen) { media.stopScreen(); return; }
    if (sceneBusy.current) return;
    sceneBusy.current = true; setScenePending(true); setSceneError('');
    try {
      let binding = scenes.activeScene?.capture;
      if (!binding) {
        if (scenes.scenes.length >= 12 && scenes.activeScene?.kind !== 'screen') { setSceneError('Selecciona una escena de pantalla o quita una escena para preparar otra fuente.'); return; }
        const chosen = await studioCapture.choose();
        if (!chosen) return;
        if (!alive.current) { await studioCapture.release(chosen.id); return; }
        binding = chosen;
        if (scenes.activeScene?.kind === 'screen') scenes.bindScene(scenes.activeScene.id, binding);
        else {
          const base = chosen.name.slice(0, 50); let name = base; let suffix = 2;
          while (scenes.scenes.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) name = `${base} (${suffix++})`;
          const error = scenes.addScene({ name, kind: 'screen', title: chosen.name, description: '', file: null, capture: chosen }, true);
          if (error) { await studioCapture.release(chosen.id); setSceneError(error); return; }
        }
      }
      if (media.zoomConnected) { await studioCapture.activate(binding.id); setSceneError('Fuente ligada. Pulsa Compartir en la reunión Zoom para transmitir esta escena.'); }
      else await media.shareBinding(binding.id);
    } catch { if (alive.current) setSceneError('No pudimos abrir la fuente ligada. Revisa permisos o vuelve a vincularla.'); }
    finally { sceneBusy.current = false; if (alive.current) setScenePending(false); }
  }
  return { sceneError, scenePending, selectScene, addScene, relinkScene, removeScene, shareScene };
}
