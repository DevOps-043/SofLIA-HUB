import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SkillWorkspaceService } from '../electron/skill-workspace/service';
import { registerPresentationScheme, registerPresentationProtocolHandler, buildPresentationUrl } from '../electron/skill-workspace/protocol';

registerPresentationScheme();
app.on('window-all-closed', () => undefined);
void app.whenReady().then(async () => {
  const folder = process.env.SOFLIA_SMOKE_OUTPUT!, result = JSON.parse(await fs.readFile(path.join(folder, 'result.json'), 'utf8'));
  const service = new SkillWorkspaceService(path.join(folder, 'workspaces'));
  registerPresentationProtocolHandler(service);
  const id = path.basename(path.dirname(path.dirname(result.video)));
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await window.loadURL(buildPresentationUrl(id, 'vista.html'));
    const quality = await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const v=document.querySelector('video');if(!v){reject(new Error('Falta video'));return}const timeout=setTimeout(()=>reject(new Error('El video no cargó')),20000);v.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Falló el decodificador de video'))},{once:true});const seek=()=>{v.pause();v.currentTime=15};v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight,seek:v.currentTime,ready:v.readyState})},{once:true});if(v.readyState>=1)seek();else v.addEventListener('loadedmetadata',seek,{once:true})})`);
    if (quality.duration !== 30 || quality.width !== 1920 || quality.height !== 1080 || quality.seek !== 15) throw new Error('La reproducción no conserva el perfil.');
    await fs.writeFile(path.join(folder, 'preview-qa.json'), JSON.stringify({ ok: true, ...quality, protocolo: 'pulse-presentacion' }, null, 2));
    console.info('MP4 reproducido y seek a 15 s verificado con el protocolo real.');
  } finally { window.destroy(); }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
