import ts from 'typescript';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const directory = await mkdtemp(path.join(tmpdir(), 'soflia-zoom-smoke-'));
const root = process.cwd();
const protocolSource = await readFile(path.join(root, 'electron/main/zoom-protocol.ts'), 'utf8');
await writeFile(path.join(directory, 'protocol.cjs'), ts.transpileModule(protocolSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
const securitySource = (await readFile(path.join(root, 'electron/preload/security.ts'), 'utf8')).replaceAll('export function ', 'function ');
await writeFile(path.join(directory, 'preload.cjs'), ts.transpileModule(`${securitySource}\ninjectCSP();`, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText);
await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"></head><body><script src="parent.js"></script></body></html>');
await writeFile(path.join(directory, 'parent.js'), `window.addEventListener('message', e => { if(e.data?.source==='soflia-zoom' && e.data?.type==='ready') { document.body.dataset.ready=e.origin; } }); const frame=document.createElement('iframe'); frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms'); frame.allow='camera; microphone; display-capture; autoplay; fullscreen'; frame.src='soflia-zoom://meeting/index.html#smoke'; document.body.append(frame);`);
await writeFile(path.join(directory, 'main.cjs'), `
const { app, protocol, BrowserWindow } = require('electron');
const path = require('node:path');
const { ZOOM_RUNTIME_SCHEME, installZoomProtocol } = require('./protocol.cjs');
protocol.registerSchemesAsPrivileged([ZOOM_RUNTIME_SCHEME]);
app.whenReady().then(async () => {
 const win = new BrowserWindow({ show:false, webPreferences:{ preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, sandbox:true, nodeIntegration:false } });
 win.webContents.on('console-message', (event) => { if(event.level==='error') console.error('SDK_CONSOLE: '+JSON.stringify({message:event.message,line:event.lineNumber,source:event.sourceId})); });
 await installZoomProtocol(win.webContents.session, ${JSON.stringify(path.join(root, 'dist/zoom-runtime'))});
 await win.loadFile(path.join(__dirname,'index.html'));
 const started=Date.now(); const timer=setInterval(async()=>{
  const ready=await win.webContents.executeJavaScript('document.body.dataset.ready || ""');
  if(ready){
    clearInterval(timer);
    const frame=win.webContents.mainFrame.frames.find(item=>item.url.startsWith('soflia-zoom://meeting/'));
    const assets=frame&&await frame.executeJavaScript('(async()=>{const manifest=await fetch("./lib/manifest.json");const wasm=await fetch("./lib/video.simd.wasm");return manifest.ok&&wasm.ok&&wasm.headers.get("content-type")==="application/wasm"&&(await wasm.arrayBuffer()).byteLength>0})()');
    console.log('SDK_READY_ORIGIN='+ready+';VIDEO_ASSETS='+!!assets); win.destroy(); app.exit(ready==='soflia-zoom://meeting'&&assets?0:1);
  }
  else if(Date.now()-started>20000){clearInterval(timer); console.error('Meeting SDK no notificó carga aislada');win.destroy();app.exit(1);}
 },200);
}).catch(()=>{console.error('No se pudo cargar Meeting SDK en Electron');app.exit(1);});
`);
const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(directory, 'main.cjs')], { env: environment, windowsHide: true, stdio: 'inherit' });
const timeout = setTimeout(() => child.kill(), 30000);
child.once('exit', (code) => { clearTimeout(timeout); process.exitCode = code ?? 1; });
