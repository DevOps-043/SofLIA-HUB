import { BrowserWindow, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { frameStamp } from '../../src/shared/audiovisual/frame-stamp';
import type { Film } from '../../src/shared/audiovisual/film-schema';
import { filmDocument } from './document';
import { inspectStageLayout } from '../../src/shared/audiovisual/layout-audit';

/** Chromium del propio Electron: tipografía local y CSS 2.5D sin instalar otro navegador. */
export async function createFilmRenderer(film: Film, root: string, directory: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('Producción cancelada.');
  const html = await filmDocument(film, root, true), file = path.join(directory, 'composicion.html');
  await fs.writeFile(file, html);
  if (signal.aborted) throw new Error('Producción cancelada.');
  const isolated = session.fromPartition(`film-${path.basename(directory)}`);
  isolated.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  isolated.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, done) => done({ cancel: true }));
  const window = new BrowserWindow({ show: false, frame:false, width: film.ancho, height: film.ancho * 9 / 16+12, useContentSize: true, webPreferences: { session: isolated, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: { useSharedTexture:false } } });
  const stop = () => { if (!window.isDestroyed()) window.destroy(); };
  signal.addEventListener('abort', stop, { once: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  try {

    await window.loadFile(file);
    window.webContents.setZoomFactor(1);
    window.setMinimumSize(film.ancho,film.ancho*9/16+12);
    window.setContentSize(film.ancho,film.ancho*9/16+12);
    window.webContents.startPainting();
    window.webContents.setFrameRate(60);
    let stampNonce=0;
    await window.webContents.executeJavaScript('window.__filmReady');
    return {
      runtimeHash: createHash('sha256').update(html).digest('hex'),
      async capture(frame: number): Promise<Buffer> {
        if(signal.aborted||window.isDestroyed())throw new Error('Producción cancelada.');
        stampNonce=stampNonce%3+1;
        const expected=frameStamp(frame,stampNonce);
        return new Promise<Buffer>((resolve,reject)=>{
          let busy=false, settled=false;
          const clean=()=>{clearTimeout(timeout);signal.removeEventListener('abort',cancel);if(!window.isDestroyed())window.webContents.removeListener('paint',paint);};
          const fail=(error:unknown)=>{if(settled)return;settled=true;clean();reject(error);};
          const cancel=()=>fail(new Error('Producción cancelada.'));
          const timeout=setTimeout(()=>fail(new Error('Chromium no entregó el fotograma solicitado.')),5000);
          const paint=async (_event:Electron.Event,_dirty:Electron.Rectangle,image:Electron.NativeImage)=>{
            if(busy||settled)return;busy=true;
            try {
              if(image.isEmpty()){busy=false;return;}
              const resized=image.resize({width:film.ancho,height:film.ancho*9/16+12,quality:'best'});
              const stamp=resized.crop({x:Math.floor(film.ancho/2),y:film.ancho*9/16+6,width:1,height:1});
              if(stamp.isEmpty()){busy=false;return;}
              const pixel=await sharp(stamp.toPNG()).removeAlpha().raw().toBuffer();
              if(expected.every((value,i)=>Math.abs(value-pixel[i])<=2)){
                const png=resized.crop({x:0,y:0,width:film.ancho,height:film.ancho*9/16}).toPNG();
                settled=true;clean();resolve(png);
              }else{busy=false;}
            }catch(error){fail(error);}
          };
          window.webContents.on('paint',paint);signal.addEventListener('abort',cancel,{once:true});
          void window.webContents.executeJavaScript(`window.__filmDraw(${frame},${stampNonce})`).then(()=>undefined).catch(fail);
        });
      },
      async audio() {
        if(signal.aborted) throw new Error('Producción cancelada.');
        const result = await window.webContents.executeJavaScript('window.__filmAudio()');
        const pcm=Buffer.from(result.base64,'base64');
        if(pcm.length!==44+film.fotogramas/film.fps*48000*6||pcm.toString('ascii',0,4)!=='RIFF'||pcm.readUInt16LE(34)!==24) throw new Error('Síntesis PCM inválida.');
        return { pcm, report:result.report };
      },
      async checkLayout(frame: number): Promise<string[]> {
        await window.webContents.executeJavaScript(`window.__filmDraw(${frame})`);
        return window.webContents.executeJavaScript(`(${inspectStageLayout.toString()})()`);
      },
      close() { signal.removeEventListener('abort', stop); stop(); },
    };
  } catch (error) { signal.removeEventListener('abort', stop); stop(); throw error; }
}
