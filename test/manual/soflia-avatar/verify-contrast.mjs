/* global document, getComputedStyle */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const output = new URL('../../../openspec/changes/replace-orb-with-avatar/reports/contrast/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 780 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4333/native-home', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const original = document.querySelector('#home-avatar');
    const templates = [...document.querySelectorAll('[data-avatar-template]')];
    const grid = document.createElement('main'); grid.id = 'contrast-grid';
    grid.style.cssText = 'display:grid;width:max-content;max-width:none;grid-template-columns:repeat(5,200px);gap:12px;padding:20px;background:var(--color-card-val);color:var(--color-text-main);font:12px Segoe UI;';
    for (const template of templates) {
      const tile = document.createElement('section'); const actor = original.cloneNode(true);
      actor.removeAttribute('id'); actor.dataset.expression = template.dataset.avatarTemplate;
      actor.style.cssText = 'width:200px;height:200px';
      actor.querySelector('.soflia-avatar__gaze').replaceChildren(template.content.cloneNode(true));
      const label = document.createElement('div'); label.textContent = actor.dataset.expression; label.style.textAlign = 'center';
      tile.append(actor, label); grid.append(tile);
    }
    document.body.replaceChildren(grid); document.body.style.margin = '0';
    // Reproduce el acento de acciones oscuro que originó el rostro tenue en Hub.
    document.documentElement.style.setProperty('--color-accent', 'var(--color-accent-val)');
  });
  await page.locator('.soflia-avatar__layer').evaluateAll(async images => Promise.all(images.map(image => image.decode())));
  const verify = async () => {
    const colors = await page.locator('.soflia-avatar').evaluateAll(actors => actors.map(actor => ({ expression: actor.dataset.expression, color: getComputedStyle(actor.querySelector('.avatar-face')).color, stroke: getComputedStyle(actor.querySelector('.avatar-face')).stroke })));
    assert.equal(colors.length, 14);
    for (const row of colors) {
      const expected = row.expression === 'warning' ? 'rgb(255, 224, 138)' : 'rgb(138, 255, 240)';
      assert.equal(row.color, expected, row.expression); assert.equal(row.stroke, expected, row.expression);
    }
    return colors;
  };
  const colors = await verify();
  await page.locator('#contrast-grid').screenshot({ path: fileURLToPath(new URL('light.png', output)) });
  await page.emulateMedia({ colorScheme: 'dark' }); await verify();
  await page.locator('#contrast-grid').screenshot({ path: fileURLToPath(new URL('dark.png', output)) });
  assert.deepEqual(errors, []);
  await fs.writeFile(new URL('browser-qa.json', output), JSON.stringify({ checks: ['14 expresiones luminosas en tema claro con acento de acciones oscuro', '14 expresiones conservan color en tema oscuro', 'Movimiento reducido conserva señales visibles', 'Documento nativo real y recursos aprobados sin modificaciones'], colors, errors }, null, 2));
  console.log('Contraste verificado: 14 expresiones, dos temas y movimiento reducido.');
} finally { await browser.close(); }
