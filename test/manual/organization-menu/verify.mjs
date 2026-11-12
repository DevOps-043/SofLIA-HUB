import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';

const output = 'tmp/organization-menu';
const previewUrl = process.env.ORGANIZATION_MENU_PREVIEW_URL || 'http://127.0.0.1:4331';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  let cases = 0;
  for (const theme of ['light', 'dark']) {
    await page.goto(`${previewUrl}/?theme=${theme}`);
    for (const shape of ['alta', 'ancha', 'cuadrada']) {
      await page.getByLabel('Marca de prueba').selectOption(shape);
      for (const mode of ['expandida', 'compacta', 'inferior']) {
        const panel = page.locator(`[data-preview="${mode}"]`);
        const logo = panel.getByRole('img');
        await logo.evaluate(image => image.decode());
        const result = await logo.evaluate(image => {
          const view = image.ownerDocument.defaultView;
          const style = view.getComputedStyle(image);
          const frame = view.getComputedStyle(image.parentElement);
          const rect = image.getBoundingClientRect();
          return { width: rect.width, height: rect.height, fit: style.objectFit, background: frame.backgroundColor,
            border: frame.borderWidth, radius: frame.borderRadius, shadow: frame.boxShadow,
            naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
        });
        assert.equal(result.fit, 'contain');
        assert.equal(result.background, 'rgba(0, 0, 0, 0)');
        assert.equal(result.border, '0px');
        assert.equal(result.radius, '0px');
        assert.equal(result.shadow, 'none');
        assert.equal(result.height, mode === 'compacta' ? 32 : 40);
        assert(result.width <= (mode === 'compacta' ? 32 : 144));
        assert(result.naturalWidth > 0 && result.naturalHeight > 0);
        cases++;
      }
    }
    await page.getByLabel('Marca de prueba').selectOption('rota');
    await page.getByLabel('Organización Logo no disponible', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('img').count(), 0);
    await page.getByLabel('Marca de prueba').selectOption('ancha');
    const expanded = page.locator('[data-preview="expandida"]');
    await expanded.getByRole('button', { name: /Menú de organización/ }).click();
    await expanded.getByText('Marca horizontal', { exact: true }).click();
    await expanded.getByRole('img').first().evaluate(image => image.decode());
    await page.screenshot({ path: `${output}/${theme}.png` });
    await expanded.getByRole('button', { name: /Logo de Marca vertical Marca vertical/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Menú de organización. Organización actual: Marca vertical' }).count(), 3);
  }
  console.log(`Verificación visual correcta: ${cases} combinaciones de tema, proporción y barra; recuperación y selección comprobadas.`);
  console.log(`Capturas locales: ${output}/light.png y ${output}/dark.png`);
} finally {
  await browser.close();
}
