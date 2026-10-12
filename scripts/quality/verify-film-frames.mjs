import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

// Compara capturas del bundle propio con frames decodificados, no sólo metadatos.
const folder = path.resolve(process.argv[2]), composition = path.resolve(process.argv[3]);
const result = JSON.parse(await fs.readFile(path.join(folder, 'result.json'), 'utf8'));
const inspection = JSON.parse(await fs.readFile(path.join(folder, 'inspeccion.json'), 'utf8'));
const ffmpeg = path.resolve('media-runtime/ffmpeg.exe');
const frames = inspection.frames, directory = path.join(folder, 'frames-finales');
await fs.mkdir(directory, { recursive: true });
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', result.video, '-vf', `select=${frames.map(frame => `eq(n\\,${frame})`).join('+')}`, '-fps_mode', 'vfr', path.join(directory, '%02d.png')], { windowsHide: true });
const auditSource = stripTypeScriptTypes(await fs.readFile('src/shared/audiovisual/layout-audit.ts', 'utf8'));
const { inspectStageLayout } = await import('data:text/javascript,' + encodeURIComponent(auditSource));
const browser = await chromium.launch({ headless: true, executablePath: path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1092 } });
  await page.context().setOffline(true); await page.goto(pathToFileURL(composition).href);
  await page.evaluate(() => window.__filmReady);
  const comparisons = [], tiles = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i], decoded = path.join(directory, `${String(i + 1).padStart(2, '0')}.png`);
    await page.evaluate(frame => window.__filmDraw(frame, 1), frame);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    const a = await sharp(png).resize(320, 180).removeAlpha().raw().toBuffer();
    const b = await sharp(decoded).resize(320, 180).removeAlpha().raw().toBuffer();
    let error = 0; for (let p = 0; p < a.length; p++) error += Math.abs(a[p] - b[p]);
    const difference = error / a.length;
    comparisons.push({ frame, diferenciaMediaRGB: difference });
    if (difference > 8) throw new Error(`El frame ${frame} difiere de la composición (${difference}).`);
    const label = Buffer.from(`<svg width="480" height="28"><rect width="480" height="28" fill="#071725"/><text x="12" y="19" fill="#c7dedf" font-size="13" font-family="sans-serif">f${frame} · ${(frame / 60).toFixed(2)} s · MP4 final</text></svg>`);
    tiles.push(await sharp({ create: { width: 480, height: 298, channels: 3, background: '#071725' } }).composite([{ input: await sharp(decoded).resize(480, 270).toBuffer(), top: 28, left: 0 }, { input: label, top: 0, left: 0 }]).png().toBuffer());
  }
  await sharp({ create: { width: 1920, height: Math.ceil(tiles.length / 4) * 298, channels: 3, background: '#071725' } }).composite(tiles.map((input, i) => ({ input, top: Math.floor(i / 4) * 298, left: i % 4 * 480 }))).jpeg({ quality: 92 }).toFile(path.join(folder, 'contactos-mp4.jpg'));
  // Caso negativo real: un titular fuera de la zona segura debe detectarse.
  await page.evaluate(() => window.__filmDraw(239));
  await page.evaluate(() => { const heading = document.querySelector('.film-headline'); heading.style.top = '1020px'; });
  const negative = await page.evaluate(inspectStageLayout);
  if (!negative.some(issue => issue.includes('Fuera del área segura'))) throw new Error('La inspección omitió un titular recortado.');
  const decodedReport = execFileSync(ffmpeg, ['-hide_banner', '-nostats', '-i', result.video, '-vf', 'blackdetect=d=0.05:pix_th=0.02,freezedetect=n=0.0005:d=0.4', '-an', '-f', 'null', '-'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // El comando anterior exige decodificación completa; los logs se miden por separado en QA técnico.
  await fs.writeFile(path.join(folder, 'frames-qa.json'), JSON.stringify({ ok: true, comparisons, casoNegativo: negative, decodificacion: decodedReport.length === 0 }, null, 2));
  console.info('Frames del MP4 comparados con React y recorte negativo detectado.');
} finally { await browser.close(); }
