import { useEffect, useRef, useState } from 'react';
import { studioCapture } from '../../../services/studio-capture';
import type { StudioCaptureBinding } from '../../../shared/studio-capture';
import type { StudioPreparedScene } from './studio-types';
import { holdingSchema, type StudioHolding } from '../../../shared/studio-program';
import {loadSceneBank,saveSceneBank,sceneMetadata} from '../../../services/studio-scene-store';

export type StudioSceneDraft = { name: string; kind: 'slide' | 'screen' | 'media' | 'holding'; title: string; description: string; file: File | null; capture?: StudioCaptureBinding | null; holding?: StudioHolding };
const MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm']);

/** Medios exclusivamente locales: las URLs se liberan al quitar o cerrar el estudio. */
export function useStudioScenes(initialScenes: StudioPreparedScene[] = [],storageKey?:string) {
  const [{ scenes: localScenes, activeId: localActiveId }, setState] = useState<{ scenes: StudioPreparedScene[]; activeId: string | null }>(() => ({ scenes: [...initialScenes], activeId: initialScenes[0]?.id ?? null }));
  // La preparación es local, pero los assets académicos conservan su renovación autorizada.
  const refreshedUrls = new Map(initialScenes.filter((scene) => scene.assetUrl).map((scene) => [scene.id, scene.assetUrl]));
  const scenes = localScenes.map((scene) => refreshedUrls.has(scene.id) ? { ...scene, assetUrl: refreshedUrls.get(scene.id) } : scene);
  const activeId = localActiveId;
  const ownedUrls = useRef(new Set<string>());
  const ownedBindings = useRef(new Set<string>());
  const files=useRef(new Map<string,Blob>());
  const academicIds=useRef(new Set(initialScenes.map(scene=>scene.id)));
  const edited=useRef(false),loaded=useRef(false),saveAllowed=useRef(false);
  const [storageNotice,setStorageNotice]=useState(''),[hydration,setHydration]=useState(0);
  const academicSignature=JSON.stringify(initialScenes.map(scene=>({id:scene.id,name:scene.name,title:scene.title,description:scene.description,kind:scene.kind})));
  useEffect(()=>{
    const previous=academicIds.current;academicIds.current=new Set(initialScenes.map(scene=>scene.id));
    setState(state=>{
      const next=[...initialScenes,...state.scenes.filter(scene=>!previous.has(scene.id)&&!academicIds.current.has(scene.id))];
      return {scenes:next,activeId:next.some(scene=>scene.id===state.activeId)?state.activeId:next[0]?.id??null};
    });
    // Las URLs académicas se renuevan arriba sin reescribir la preparación local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[academicSignature]);
  useEffect(()=>{
    if(!storageKey)return;let disposed=false;
    void loadSceneBank(storageKey).then(saved=>{
      if(disposed)return;saveAllowed.current=true;if(edited.current)return;
      const restored=saved.filter(item=>!academicIds.current.has(item.scene.id)).map(({scene,blob})=>{
        const assetUrl=blob?URL.createObjectURL(blob):undefined;
        if(assetUrl)ownedUrls.current.add(assetUrl);if(blob)files.current.set(scene.id,blob);
        return {...scene,assetUrl};
      });
      setState(state=>({scenes:[...state.scenes,...restored],activeId:state.activeId??restored[0]?.id??null}));
    }).catch(()=>{if(!disposed)setStorageNotice('No se pudo recuperar la preparación local. Puedes preparar nuevas escenas.');})
      .finally(()=>{if(!disposed){loaded.current=true;setHydration(value=>value+1);}});
    return()=>{disposed=true;};
  },[storageKey]);
  useEffect(()=>{
    if(!storageKey||!loaded.current||!saveAllowed.current)return;
    let disposed=false;
    void Promise.resolve().then(async()=>{
    try{
      const saved=localScenes.filter(scene=>!academicIds.current.has(scene.id)).map(scene=>({scene:sceneMetadata(scene),...(files.current.has(scene.id)?{blob:files.current.get(scene.id)}:{})}));
      await saveSceneBank(storageKey,saved);if(!disposed)setStorageNotice('');
    }catch{if(!disposed)setStorageNotice('No se pudo guardar la preparación local. Revisa el espacio disponible y el límite de 100 MB; los cambios siguen en esta sesión.');}
    });
    return()=>{disposed=true;};
  },[localScenes,storageKey,hydration]);
  useEffect(() => {
    const urls = ownedUrls.current;
    const bindings = ownedBindings.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); bindings.forEach((id) => void studioCapture.release(id).catch(() => console.warn('[Estudio] No se pudo liberar una fuente al cerrar.'))); bindings.clear(); };
  }, []);
  function addScene(draft: StudioSceneDraft, activate = false, onCreated?: (scene: StudioPreparedScene) => void): string | null {
    if(storageKey&&!loaded.current)return 'Espera a que se recupere la preparación local.';
    const name = draft.name.trim();
    if (!name || name.length > 60) return 'Escribe un nombre de hasta 60 caracteres.';
    if (scenes.length >= 12) return 'Puedes preparar hasta 12 escenas.';
    if (scenes.some((scene) => scene.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return 'Ya hay una escena con ese nombre.';
    if (draft.title.length > 160 || draft.description.length > 500) return 'Acorta el título o la descripción de la escena.';
    if (draft.kind === 'media' && (!draft.file || !MEDIA_TYPES.has(draft.file.type))) return 'Elige una imagen PNG, JPG, WebP, GIF, AVIF o un video MP4/WebM.';
    if (draft.file && draft.file.size > 25 * 1024 * 1024) return 'El archivo debe pesar como máximo 25 MB.';
    if (draft.kind === 'screen' && !draft.capture) return 'Vincula una pantalla, ventana o pestaña para crear esta escena.';
    if (draft.kind === 'holding' && !holdingSchema.safeParse(draft.holding, { jitless: true }).success) return 'Configura la pantalla y un reloj de hasta 120 minutos.';
    const file = draft.kind === 'media' ? draft.file : null;
    const assetUrl = file ? URL.createObjectURL(file) : undefined;
    if (assetUrl) ownedUrls.current.add(assetUrl);
    const capture = draft.kind === 'screen' ? draft.capture ?? undefined : undefined;
    if (capture) ownedBindings.current.add(capture.id);
    const scene: StudioPreparedScene = { id: crypto.randomUUID(), name, kind: file ? (file.type.startsWith('video/') ? 'video' : 'image') : draft.kind === 'screen' ? 'screen' : draft.kind === 'holding' ? 'holding' : 'slide', title: draft.title.trim() || name, description: draft.description.trim(), assetUrl, fileName: file?.name, capture, holding: draft.kind === 'holding' ? draft.holding : undefined };
    edited.current=true;if(file)files.current.set(scene.id,file);
    setState((previous) => ({ scenes: [...previous.scenes, scene], activeId: activate ? scene.id : previous.activeId ?? scene.id }));
    onCreated?.(scene);
    return null;
  }
  function removeScene(id: string) {
    if(storageKey&&!loaded.current)return;
    edited.current=true;files.current.delete(id);
    const url = scenes.find((scene) => scene.id === id)?.assetUrl;
    if (url && ownedUrls.current.delete(url)) URL.revokeObjectURL(url);
    const binding = scenes.find((scene) => scene.id === id)?.capture;
    if (binding && ownedBindings.current.delete(binding.id)) void studioCapture.release(binding.id).catch(() => console.warn('[Estudio] No se pudo liberar el vínculo de la escena.'));
    setState((previous) => {
      const remaining = previous.scenes.filter((scene) => scene.id !== id);
      return { scenes: remaining, activeId: previous.activeId === id ? remaining[0]?.id ?? null : previous.activeId };
    });
  }
  function selectScene(id: string) {
    setState((previous) => previous.scenes.some((scene) => scene.id === id) ? { ...previous, activeId: id } : previous);
  }
  function bindScene(id: string, capture: StudioCaptureBinding): void {
    const scene = scenes.find((item) => item.id === id);
    if (!scene || scene.kind !== 'screen') return;
    const previous = scene.capture;
    ownedBindings.current.add(capture.id);
    setState((state) => ({ ...state, scenes: state.scenes.map((item) => item.id === id ? { ...item, capture } : item) }));
    if (previous && previous.id !== capture.id && ownedBindings.current.delete(previous.id)) void studioCapture.release(previous.id).catch(() => console.warn('[Estudio] No se pudo liberar el vínculo anterior.'));
  }
  return { scenes, activeScene: scenes.find((scene) => scene.id === activeId) ?? null, storageNotice,addScene, removeScene, selectScene, bindScene };
}
