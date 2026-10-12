const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const output = path.resolve('work/orb-guidance');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.SOFLIA_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 760, height: 700 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:4321/');
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await page.locator('canvas').waitFor();
    await page.getByTestId('compact-orb').screenshot({ path: path.join(output, 'orb-dark.png') });
    const layout = await page.getByTestId('compact-orb').evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }));
    if (layout.scrollHeight > layout.height) throw new Error('El orbe compacto recorta controles');
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    if (!await page.getByRole('button', { name: 'Comprobar paso' }).isDisabled()) throw new Error('La pausa permite comprobar');
    await page.getByRole('button', { name: 'Reanudar' }).click();
    await page.getByRole('combobox', { name: 'Señalar con' }).selectOption('arrow');
    await page.getByRole('button', { name: 'Modo claro' }).click();
    await page.getByTestId('compact-orb').screenshot({ path: path.join(output, 'orb-light.png') });
    await page.getByRole('button', { name: /Práctica con SofLIA/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Preparar práctica guiada' });
    await dialog.getByRole('textbox', { name: 'Título de la práctica' }).fill('Crear tabla');
    await dialog.getByRole('textbox', { name: 'Instrucción', exact: true }).fill('Abre Insertar');
    await dialog.getByRole('textbox', { name: 'Texto del control que SofLIA señalará' }).fill('Insertar');
    await dialog.getByRole('textbox', { name: 'Texto visible que confirma el resultado' }).fill('Tabla');
    await dialog.screenshot({ path: path.join(output, 'practice-form.png') });
    await dialog.getByRole('button', { name: 'Iniciar práctica local' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 320, height: 700 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow || errors.length) throw new Error(JSON.stringify({ overflow, errors }));
    console.log(JSON.stringify({ success: true, flow: 'orbe compacto, ambos temas, pausa, estilo, receta local y ancho reducido', screenshots: 3 }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
