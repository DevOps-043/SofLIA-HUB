import { useEffect, useRef, useState } from 'react';
import type { StudioPreparedScene } from './studio-types';

export type StudioSceneDraft = { name: string; kind: 'slide' | 'screen' | 'media'; title: string; description: string; file: File | null };
const MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm']);

/** Medios exclusivamente locales: las URLs se liberan al quitar o cerrar el estudio. */
export function useStudioScenes(initialScenes: StudioPreparedScene[] = []) {
  const [{ scenes, activeId }, setState] = useState<{ scenes: StudioPreparedScene[]; activeId: string | null }>(() => ({ scenes: [...initialScenes], activeId: initialScenes[0]?.id ?? null }));
  const ownedUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = ownedUrls.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);
  function addScene(draft: StudioSceneDraft): string | null {
    const name = draft.name.trim();
    if (!name || name.length > 60) return 'Escribe un nombre de hasta 60 caracteres.';
    if (scenes.length >= 12) return 'Puedes preparar hasta 12 escenas.';
    if (scenes.some((scene) => scene.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return 'Ya hay una escena con ese nombre.';
    if (draft.title.length > 160 || draft.description.length > 500) return 'Acorta el título o la descripción de la escena.';
    if (draft.kind === 'media' && (!draft.file || !MEDIA_TYPES.has(draft.file.type))) return 'Elige una imagen PNG, JPG, WebP, GIF, AVIF o un video MP4/WebM.';
    if (draft.file && draft.file.size > 25 * 1024 * 1024) return 'El archivo debe pesar como máximo 25 MB.';
    const file = draft.kind === 'media' ? draft.file : null;
    const assetUrl = file ? URL.createObjectURL(file) : undefined;
    if (assetUrl) ownedUrls.current.add(assetUrl);
    const scene: StudioPreparedScene = { id: crypto.randomUUID(), name, kind: file ? (file.type.startsWith('video/') ? 'video' : 'image') : draft.kind === 'screen' ? 'screen' : 'slide', title: draft.title.trim() || name, description: draft.description.trim(), assetUrl, fileName: file?.name };
    setState((previous) => ({ scenes: [...previous.scenes, scene], activeId: previous.activeId ?? scene.id }));
    return null;
  }
  function removeScene(id: string) {
    const url = scenes.find((scene) => scene.id === id)?.assetUrl;
    if (url && ownedUrls.current.delete(url)) URL.revokeObjectURL(url);
    setState((previous) => {
      const remaining = previous.scenes.filter((scene) => scene.id !== id);
      return { scenes: remaining, activeId: previous.activeId === id ? remaining[0]?.id ?? null : previous.activeId };
    });
  }
  function selectScene(id: string) {
    setState((previous) => previous.scenes.some((scene) => scene.id === id) ? { ...previous, activeId: id } : previous);
  }
  return { scenes, activeScene: scenes.find((scene) => scene.id === activeId) ?? null, addScene, removeScene, selectScene };
}
