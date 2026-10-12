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
  await page.context().setOffline(true); await page.goto(pathToFileURL(result.html).href); await page.waitForTimeout(1000);
  for (let i = 0; i < 5; i++) {
    titles.push(await page.locator('h1').innerText());
    const file = path.join(folder, `slide-${i + 1}.png`); await page.screenshot({ path: file });
    shots.push(await sharp(file).resize(640, 360).toBuffer());
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000);
  }
  const ok = !errors.length && !remote.length && new Set(titles).size === 5;
  await sharp({ create: { width: 1920, height: 720, channels: 3, background: '#071119' } }).composite(shots.map((input, i) => ({ input, left: i % 3 * 640, top: Math.floor(i / 3) * 360 }))).png().toFile(path.join(folder, 'contactos-slides.png'));
  await fs.writeFile(path.join(folder, 'html-qa.json'), JSON.stringify({ ok, errors, remote, titles, offline: true }, null, 2));
  console.info(ok ? 'HTML verificado sin red: cinco diapositivas distintas, sin errores.' : 'Falló la verificación HTML.');
  if (!ok) process.exitCode = 1;
} finally { await browser.close(); }
