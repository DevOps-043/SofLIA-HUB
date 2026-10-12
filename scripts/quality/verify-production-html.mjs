import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const folder = path.resolve(process.argv[2] ?? 'production-smoke');
const executablePath = process.argv[3] ?? path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe');
const result = JSON.parse(await fs.readFile(path.join(folder, 'result.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [], remote = [], titles = [], shots = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
  await page.context().setOffline(true); await page.goto(pathToFileURL(result.html).href); await page.waitForTimeout(2500);
  for (let i = 0; i < 5; i++) {
    titles.push(await page.locator('h1').innerText());
    const file = path.join(folder, `slide-${i + 1}.png`); await page.screenshot({ path: file });
    shots.push(await sharp(file).resize(640, 360).toBuffer());
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500);
  }
  const ok = !errors.length && !remote.length && new Set(titles).size === 5;
  await sharp({ create: { width: 1920, height: 720, channels: 3, background: '#071119' } }).composite(shots.map((input, i) => ({ input, left: i % 3 * 640, top: Math.floor(i / 3) * 360 }))).png().toFile(path.join(folder, 'contactos-slides.png'));
  const original = await fs.readFile(result.html, 'utf8');
  const embedded = original.match(/window\.__PULSE_PRESENTATION__=([\s\S]*?);<\/script>/)?.[1];
  let processStress = null;
  if (embedded) {
    const payload = JSON.parse(embedded), processSlide = payload.deck.slides.find(slide => slide.tipo === 'proceso');
    if (processSlide) {
      processSlide.pasos = Array.from({ length: 5 }, (_, i) => ({ numero: String(i + 1), titulo: 'VALIDACIÓN Y COORDINACIÓN CON EVIDENCIA', texto: 'Revisar las fuentes, contrastar el contexto y conservar la aprobación humana antes de avanzar a la siguiente etapa.' }));
      payload.deck.slides = [processSlide, ...payload.deck.slides.filter(slide => slide !== processSlide).slice(0, 2)];
      const stressFile = path.join(folder, 'proceso-denso.html');
      await fs.writeFile(stressFile, original.replace(embedded, JSON.stringify(payload).replace(/</g, '\\u003c')));
      await page.goto(pathToFileURL(stressFile).href); await page.waitForTimeout(2500);
      processStress = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.runtime-process-step')];
        return { horizontal: !!document.querySelector('.runtime-process--horizontal'), pasos: nodes.length, fuera: nodes.filter(node => node.getBoundingClientRect().bottom > 970 || node.getBoundingClientRect().right > 1820).length };
      });
      await page.screenshot({ path: path.join(folder, 'proceso-denso.png') });
      if (processStress.pasos !== 5 || processStress.fuera || !processStress.horizontal) throw new Error('El proceso denso se recorta o no adopta su layout seguro.');
    }
  }
  await fs.writeFile(path.join(folder, 'html-qa.json'), JSON.stringify({ ok, errors, remote, titles, processStress, offline: true }, null, 2));
  console.info(ok ? 'HTML verificado sin red: cinco diapositivas distintas, sin errores.' : 'Falló la verificación HTML.');
  if (!ok) process.exitCode = 1;
} finally { await browser.close(); }
