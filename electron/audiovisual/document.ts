import fs from 'node:fs/promises';
import path from 'node:path';
import type { Film } from '../../src/shared/audiovisual/film-schema';
import { cinematicFilm } from '../../src/shared/audiovisual/normalize';

/** Únicamente recursos compilados del producto, nunca código procedente del manifiesto. */
export async function filmDocument(film: Film, root: string, capture = false): Promise<string> {
  const bundleRoot = path.join(root, 'dist/audiovisual');
  const [script, css, regular, bold, mono] = await Promise.all([
    fs.readFile(path.join(bundleRoot, 'film-runtime.iife.js'), 'utf8'),
    fs.readFile(path.join(bundleRoot, 'film-runtime.css'), 'utf8'),
    fs.readFile(path.join(root, 'resources/audiovisual/fonts/InterDisplay-Regular.woff2')),
    fs.readFile(path.join(root, 'resources/audiovisual/fonts/InterDisplay-SemiBold.woff2')),
    fs.readFile(path.join(root, 'resources/audiovisual/fonts/JetBrainsMono-Regular.woff2')),
  ]);
  const fonts = `@font-face{font-family:'Film Inter';src:url(data:font/woff2;base64,${regular.toString('base64')}) format('woff2');font-weight:400;font-display:block}@font-face{font-family:'Film Inter';src:url(data:font/woff2;base64,${bold.toString('base64')}) format('woff2');font-weight:600 900;font-display:block}@font-face{font-family:'Film Mono';src:url(data:font/woff2;base64,${mono.toString('base64')}) format('woff2');font-weight:400;font-display:block}`;
  const payload = JSON.stringify(cinematicFilm(film)).replace(/</g, '\\u003c');
  const safeScript = script.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#071119}#root{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center}${fonts}${css}</style></head><body><div id="root"></div><script>window.__FILM__=${payload};window.__FILM_CAPTURE__=${capture};</script><script>${safeScript}</script></body></html>`;
  if (Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error('El runtime audiovisual supera 2 MB.');
  return html;
}
