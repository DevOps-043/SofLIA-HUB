import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';
import sharp from 'sharp';
await mkdir('tmp/organization-settings', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1320, height: 980 } });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'assets.example.test') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="50"><path d="m25 2 23 23-23 23L2 25Z" fill="#00d4b3"/><text x="60" y="35" font-family="Arial" font-size="30" fill="#00d4b3">DEMO</text></svg>' });
    return route.abort();
  });
  for (const theme of ['dark', 'light']) {
    await page.goto(`http://127.0.0.1:4333/?theme=${theme}`);
    await page.getByLabel('Nombre de la organización').waitFor();
    assert(await page.getByRole('button', { name: 'Organización', exact: true }).isVisible());
    await page.screenshot({ path: `tmp/organization-settings/${theme}.png` });
    const icon = await sharp({ create: { width: 32, height: 64, channels: 4, background: { r: 0, g: 212, b: 179, alpha: 1 } } }).png().toBuffer();
    await page.getByLabel('Subir icono', { exact: true }).setInputFiles({ name: 'icono.png', mimeType: 'image/png', buffer: icon });
    await page.getByAltText('Vista previa de icono').waitFor();
    await page.getByAltText('Vista previa de icono').evaluate(image => image.decode());
    await page.getByLabel('Nombre de la organización').fill('Empresa actualizada');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await page.getByText('Cambios guardados.', { exact: true }).waitFor();
    await page.screenshot({ path: `tmp/organization-settings/${theme}-saved.png` });
    await page.getByRole('button', { name: 'Cerrar Ajustes' }).click();
    const trigger = page.getByRole('button', { name: 'Menú de organización. Organización actual: Empresa actualizada' });
    assert(await trigger.getByText('Empresa actualizada', { exact: true }).isVisible());
    assert.equal(await trigger.locator('svg').count(), 0);
    await trigger.hover();
    assert.equal(await trigger.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
    const style = await page.locator('.account-menu-footer').evaluate(element => {
      const view = element.ownerDocument.defaultView;
      return { background: view.getComputedStyle(element).backgroundColor, border: view.getComputedStyle(element).borderTopWidth, font: view.getComputedStyle(element.querySelector('button > div span')).fontSize };
    });
    assert.equal(style.background, 'rgba(0, 0, 0, 0)'); assert.equal(style.border, '1px'); assert.equal(style.font, '15px');
    await page.screenshot({ path: `tmp/organization-settings/${theme}-menu.png` });
  }
  await page.setViewportSize({ width: 900, height: 760 });
  await page.goto('http://127.0.0.1:4333/');
  await page.getByLabel('Nombre de la organización').waitFor();
  assert(await page.locator('.settings-workspace').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
  await page.goto('http://127.0.0.1:4333/?role=member');
  await page.getByRole('alert').filter({ hasText: 'Solo los propietarios' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Organización', exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Nombre de la organización').count(), 0);
  console.log('UI verificada: formulario claro/oscuro, guardado explícito, menú actualizado/transparente sin flecha y acceso denegado a miembros.');
} finally { await browser.close(); }
