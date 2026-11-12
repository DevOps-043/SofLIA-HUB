/* global document, getComputedStyle, innerWidth */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const output = new URL('../../../openspec/changes/replace-orb-with-avatar/reports/chat-profile/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const errors = []; const checks = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('http://127.0.0.1:4333/integration.html', { waitUntil: 'networkidle' });
  await page.getByLabel('Con conversación').check();
  const chat = page.locator('.qa-chat'); const avatar = chat.locator('.chat-avatar-profile .soflia-avatar');
  assert.equal(await chat.locator('.soflia-avatar').count(), 1);
  assert.equal(await page.locator('.chat-avatar-presence').count(), 0);
  assert.equal(await chat.locator('.chat-avatar-profile').evaluate(element => getComputedStyle(element).width), '72px');
  await page.getByLabel('Mensaje a SofLIA').fill('No entiendo??');
  await page.waitForFunction(() => document.querySelector('.qa-chat .chat-avatar-profile .soflia-avatar')?.dataset.expression === 'confused');
  checks.push('Un único perfil de 72 px en chat flotante, sin personaje inferior, reactivo al borrador');
  await chat.screenshot({ path: fileURLToPath(new URL('floating.png', output)) });
  await page.getByLabel('Mensaje a SofLIA').fill('');
  for (const expression of ['thinking', 'speaking', 'warning', 'focused', 'sleeping']) {
    await page.getByLabel('Estado de prueba').selectOption(expression);
    await page.waitForFunction(value => document.querySelector('.qa-chat .chat-avatar-profile .soflia-avatar')?.dataset.expression === value, expression);
    assert.equal(await chat.locator('.soflia-avatar').count(), 1);
  }
  checks.push('Pensamiento, respuesta, advertencia, concentración y reposo ocurren en el perfil superior');
  await page.getByLabel('Estado de prueba').selectOption('idle');
  await page.evaluate(() => {
    const chat = document.querySelector('.qa-chat'); chat.classList.remove('soflia-floating-chat-ui');
    chat.style.cssText = 'width:calc(100% - 32px);height:650px;margin:16px;';
    document.querySelector('.qa-layout').style.cssText = 'display:block;height:auto';
    document.querySelector('.qa-home').hidden = true; document.querySelector('.qa-project').hidden = true;
  });
  assert.equal(await chat.locator('.chat-avatar-profile').evaluate(element => getComputedStyle(element).width), '88px');
  await chat.screenshot({ path: fileURLToPath(new URL('desktop.png', output)) });
  checks.push('Perfil de 88 px en chat amplio con columna de respuesta flexible');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await chat.locator('.chat-avatar-profile').evaluate(element => getComputedStyle(element).width), '72px');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByLabel('Estado de prueba').selectOption('focused');
  await page.waitForFunction(() => document.querySelector('.qa-chat .chat-avatar-profile .soflia-avatar')?.dataset.expression === 'focused');
  assert.equal(await chat.locator('.chat-avatar-profile[data-live="true"]').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByLabel('Estado de prueba').selectOption('idle');
  await chat.screenshot({ path: fileURLToPath(new URL('mobile.png', output)) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.qa-chat .soflia-avatar')?.dataset.running === 'false');
  checks.push('A 390 px no hay desbordamiento y el perfil respeta movimiento reducido');
  assert.deepEqual(errors, []);
  await fs.writeFile(new URL('browser-qa.json', output), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
