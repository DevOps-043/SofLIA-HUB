import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build, createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Integración local autocontenida: no inicia Hub, no lee .env ni usa una reunión.
const root = process.cwd(), require = createRequire(import.meta.url);
const directory = await mkdtemp(path.join(tmpdir(), 'soflia-program-smoke-'));
const absolute = (file) => path.join(root, file).replaceAll('\\', '/');
const entry = path.join(directory, 'entry.ts');
await writeFile(entry, `export { configureMainDisplayMedia } from ${JSON.stringify(absolute('electron/main/display-media.ts'))};
export { resolveStudioOutput } from ${JSON.stringify(absolute('electron/studio-output/index.ts'))};
export { setAuthState } from ${JSON.stringify(absolute('electron/main/auth-state.ts'))};`);
for (const [file, name] of [[entry, 'output.cjs'], [absolute('electron/preload.ts'), 'preload.js']]) await build({ configFile: false, envFile: false, root, logLevel: 'error', build: { outDir: path.join(directory, 'dist-electron'), emptyOutDir: false, minify: false, lib: { entry: file, formats: ['cjs'], fileName: () => name }, rolldownOptions: { external: ['electron', /^node:/] } } });
const server = await createServer({ configFile: false, envFile: false, root: path.join(root, 'test/manual/studio-program'), plugins: [react(), { name: 'captura-de-prueba', configureServer(server) { server.middlewares.use((req, res, next) => {
  if (req.url !== '/zoom-runtime/index.html') return next();
  res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html><body><video muted autoplay></video><script>
let stream;const video=document.querySelector('video');
navigator.mediaDevices.getDisplayMedia({video:true,audio:false}).then(async value=>{stream=value;video.srcObject=stream;await video.play();parent.postMessage({track:stream.getVideoTracks()[0].id},location.origin)}).catch(error=>parent.postMessage({error:error.message},location.origin));
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='sample'||!stream)return;const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(video,0,0,1,1);parent.postMessage({pixel:Array.from(ctx.getImageData(0,0,1,1).data),track:stream.getVideoTracks()[0].id},location.origin)});
</script></body></html>`);
}); } }], logLevel: 'error', server: { host: '127.0.0.1', port: 0, fs: { allow: [root, directory] } } });
await server.listen(); const devUrl = server.resolvedUrls.local[0];
await writeFile(path.join(directory, 'main.cjs'), `
const {app,BrowserWindow}=require('electron');const fs=require('node:fs');const path=require('node:path');
const {configureMainDisplayMedia,resolveStudioOutput,setAuthState}=require('./dist-electron/output.cjs');
app.setPath('userData',path.join(__dirname,'profile'));app.setAppPath(__dirname);
app.whenReady().then(async()=>{
 setAuthState({authenticated:true,userId:'prueba-programa'});
 const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'dist-electron/preload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
 configureMainDisplayMedia(win);
 let isolated=false;
 app.on('web-contents-created',(_event,contents)=>{contents.on('console-message',event=>{
  if(event.message.startsWith('QA_RECEPTOR ')){const r=JSON.parse(event.message.slice(12));isolated=r.publisher==='undefined'&&r.general==='undefined'&&r.receiver.join(',')==='answer,offer,state'}
 })});
 win.webContents.on('console-message',event=>{
  if(event.message.startsWith('QA_ERROR ')){console.error(event.message);app.exit(1)}
  if(!event.message.startsWith('QA_PROGRAMA '))return;
  const r=JSON.parse(event.message.slice(12));const output=resolveStudioOutput(win);
  const valid=r.first[0]>180&&r.first[1]<60&&r.second[1]>180&&r.second[0]<60&&r.third[2]>180&&r.third[1]<60&&r.visual[0]>180&&r.visual[1]>180&&r.visual[2]<60&&r.fourth[0]>180&&r.fourth[1]<60&&r.sameTrack&&isolated&&output.frame&&output.frame!==win.webContents.mainFrame;
  console.log('PROGRAMA_CONTINUO_'+(valid?'OK':'FALLO')+' '+JSON.stringify({...r,receptorAislado:isolated}));
  setTimeout(()=>{win.destroy();app.exit(valid?0:1)},100);
 });
 await win.loadURL(${JSON.stringify(devUrl)});
}).catch(error=>{console.error(error);app.exit(1)});
setTimeout(()=>{console.error('Tiempo de prueba agotado');app.exit(1)},90000);
`);
try {
  const env = { ...process.env, VITE_DEV_SERVER_URL: devUrl }; delete env.ELECTRON_RUN_AS_NODE;
  const code = await new Promise((resolve, reject) => { const child = spawn(require('electron'), [path.join(directory, 'main.cjs')], { env, windowsHide: true, stdio: 'inherit' }); child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
} finally { await server.close(); }
