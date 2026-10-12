import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareFilmPreview } from '../electron/audiovisual/preview';
import { SkillWorkspaceService } from '../electron/skill-workspace/service';
import { registerPresentationScheme, registerPresentationProtocolHandler, buildPresentationUrl } from '../electron/skill-workspace/protocol';

registerPresentationScheme();
app.on('window-all-closed', () => undefined);
void app.whenReady().then(async () => {
  const folder = process.env.SOFLIA_SMOKE_OUTPUT!, result = JSON.parse(await fs.readFile(path.join(folder, 'result.json'), 'utf8'));
  const service = new SkillWorkspaceService(path.join(folder, 'workspaces'));
  registerPresentationProtocolHandler(service);
  const id = path.basename(path.dirname(path.dirname(result.video)));
  // Equivale a la preparación que hace skill-workspace:preview-url en el panel.
  await prepareFilmPreview(service, id, process.env.SOFLIA_SMOKE_ROOT!);
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  try {
    await window.loadURL(buildPresentationUrl(id, 'vista.html'));
    const quality = await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const v=document.querySelector('video');if(!v){reject(new Error('Falta video'));return}const timeout=setTimeout(()=>reject(new Error('El video no cargó')),20000);v.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Falló el decodificador de video'))},{once:true});const seek=()=>{v.pause();v.currentTime=15};v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight,seek:v.currentTime,ready:v.readyState})},{once:true});if(v.readyState>=1)seek();else v.addEventListener('loadedmetadata',seek,{once:true})})`);
    if (quality.duration !== 30 || quality.width !== 1920 || quality.height !== 1080 || quality.seek !== 15) throw new Error('La reproducción no conserva el perfil.');
    const originalDocument = await window.webContents.executeJavaScript('window.__playbackDocument = document; true');
    const saved = await service.readFile(id, 'guion.md');
    if (!saved.ok) throw new Error(saved.error);
    let successfulEdits = 0, editError: string | null = null, pending = Promise.resolve();
    const edits = setInterval(() => {
      pending = pending.then(async () => {
        const changed = await service.writeFile(id, 'guion.md', 'Revisión durante la reproducción: ' + Date.now());
        if (changed.ok) successfulEdits++; else editError = changed.error;
      }).catch(() => { editError = 'Falló la edición documental durante la prueba.'; });
    }, 2000);
    let testError: unknown = null;
    try {
      const playback = await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const v=document.querySelector('video');const timeout=setTimeout(()=>reject(new Error('No terminó la reproducción')),45000);v.muted=true;v.currentTime=0;v.addEventListener('ended',()=>{clearTimeout(timeout);resolve({final:v.currentTime,mismoDocumento:window.__playbackDocument===document,frames:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames})},{once:true});v.play().catch(reject)})`);
      if (!originalDocument || playback.final < 29.95 || !playback.mismoDocumento) throw new Error('La reproducción completa se interrumpió.');
      await pending;
      if (editError || successfulEdits < 1) throw new Error(editError ?? 'La prueba no completó ninguna edición.');
      await fs.writeFile(path.join(folder, 'preview-qa.json'), JSON.stringify({ ok: true, ...quality, ...playback, edicionDurantePlayback: true, edicionesCompletadas: successfulEdits, contenedor: 'ventana headless sin panel React', protocolo: 'pulse-presentacion' }, null, 2));
      console.info('Reproducción completa de 30 s, seek y edición de guion verificados con el protocolo real.');
    } catch (error) { testError = error; } finally {
      clearInterval(edits); await pending;
      const restored = await service.writeFile(id, 'guion.md', saved.data);
      if (!restored.ok) testError = new Error('No se pudo restaurar el guion de la prueba: ' + restored.error);
    }
    if (testError) throw testError;
  } finally { window.destroy(); }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
