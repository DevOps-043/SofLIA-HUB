/* global document, requestAnimationFrame, HTMLInputElement, innerWidth, Image, MediaRecorder, getComputedStyle, XMLSerializer, DOMMatrixReadOnly */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reports = path.join(root, 'openspec/changes/replace-orb-with-avatar/reports');
const exportsDirectory = path.join(root, 'test/manual/soflia-avatar/exports');
await fs.mkdir(reports, { recursive: true }); await fs.mkdir(exportsDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.AVATAR_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const failures = [];
const result = { checks: [], performance: null, audio: null, assets: null };
const check = name => result.checks.push(name);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('http://127.0.0.1:4330/', { waitUntil: 'networkidle' });
  await page.locator('.soflia-avatar__layer').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); });
  assert.equal(await page.locator('canvas').count(), 0);
  const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert.ok(!loaded.some(url => /three|OrbMesh|\.glb/i.test(url)));
  check('Recursos originales cargados sin WebGL, Three.js ni GLB');
  const avatar = page.locator('.soflia-avatar');
  const rig = page.locator('.soflia-avatar__rig');
  const box = await rig.boundingBox(); assert.ok(box);
  const read = property => avatar.evaluate((element, name) => parseFloat(element.style.getPropertyValue(`--avatar-${name}`)), property);
  await page.mouse.move(box.x + box.width + 20, box.y + box.height * .51);
  await page.waitForTimeout(400); assert.ok(await read('gaze-x') > .8);
  await page.mouse.move(1278, 2); await page.waitForTimeout(1000); assert.ok(Math.abs(await read('gaze-x')) < .02);
  check('Mirada desde fuera del componente, desplazamiento limitado y retorno suave');
  await page.getByRole('button', { name: 'Pensando', exact: true }).click();
  await page.mouse.move(box.x + box.width, box.y + box.height * .51); await page.waitForTimeout(400);
  assert.equal(await read('gaze-x'), 0);
  check('Pensando mantiene prioridad y no sigue el cursor');
  await page.getByRole('button', { name: 'En espera', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Animación', exact: true }).uncheck();
  assert.equal(await avatar.getAttribute('data-running'), 'false');
  await page.getByRole('checkbox', { name: 'Animación', exact: true }).check();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.soflia-avatar').dataset.running === 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('.soflia-avatar').dataset.running === 'true');
  check('Pausa explícita y movimiento reducido sin bucle visual');
  await page.getByRole('button', { name: 'Curiosidad', exact: true }).click();
  await page.waitForTimeout(600);
  const beforeTransition = await rig.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) };
  });
  await page.getByRole('button', { name: 'Alegría', exact: true }).evaluate(element => element.click());
  const afterTransition = await rig.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) };
  });
  assert.ok(Math.hypot(afterTransition.x - beforeTransition.x, afterTransition.y - beforeTransition.y) < 2);
  assert.ok(Math.abs(afterTransition.angle - beforeTransition.angle) < .02);
  check('Cambio de expresión continuo en posición e inclinación, sin reinicio de pose');
  result.performance = await page.evaluate(() => new Promise(resolve => {
    const samples = []; let previous = 0; let previousPose = null; let maxTravelPx = 0; let maxRotationRad = 0;
    const frame = now => {
      if (previous) samples.push(now - previous); previous = now;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.soflia-avatar__rig')).transform);
      const pose = { x: matrix.e, y: matrix.f, angle: Math.atan2(matrix.b, matrix.a) };
      if (previousPose) {
        maxTravelPx = Math.max(maxTravelPx, Math.hypot(pose.x - previousPose.x, pose.y - previousPose.y));
        maxRotationRad = Math.max(maxRotationRad, Math.abs(pose.angle - previousPose.angle));
      }
      previousPose = pose;
      if (samples.length < 120) requestAnimationFrame(frame);
      else { const sorted = [...samples].sort((a, b) => a - b); resolve({ samples: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1), maxTravelPx, maxRotationRad, measuredIn: navigator.userAgent }); }
    };
    requestAnimationFrame(frame);
  }));
  await page.getByRole('button', { name: 'En espera', exact: true }).click();
  await page.screenshot({ path: path.join(reports, 'demo-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fondo claro', exact: true }).click();
  await page.screenshot({ path: path.join(reports, 'demo-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fondo oscuro', exact: true }).click();

  async function slider(name, value) {
    await page.getByRole('slider', { name, exact: true }).evaluate((element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(next));
      element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  for (const size of [112, 176, 340, 560]) {
    await slider('Tamaño', size);
    const bounds = await rig.boundingBox(); assert.ok(bounds.width > 0 && bounds.height > 0);
    assert.ok(Math.abs(bounds.width / bounds.height - 1312 / 1199) < .01);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await slider('Tamaño', 340);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(reports, 'demo-mobile.png'), fullPage: true });
  check('Sin desbordamiento móvil y proporción original a 112, 176, 340 y 560 px');
  await page.setViewportSize({ width: 1280, height: 900 }); await slider('Tamaño', 360);

  // WAV generado localmente: prueba el analizador de audio, no simula una API de voz.
  function voiceWav(hz, amplitude) {
    const sampleRate = 16000; const count = sampleRate * 3;
    const wav = Buffer.alloc(44 + count * 2);
    wav.write('RIFF'); wav.writeUInt32LE(36 + count * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * hz / sampleRate) * amplitude * 32767), 44 + i * 2);
    return wav;
  }
  const wav = voiceWav(440, .22);
  await page.locator('input[type="file"]').setInputFiles({ name: 'prueba-local.wav', mimeType: 'audio/wav', buffer: wav });
  await page.locator('audio').evaluate(element => element.play()); await page.waitForTimeout(500);
  const activeLevel = await read('energy'); assert.ok(activeLevel > .25);
  const activeMouth = await page.locator('.avatar-face__mouth').getAttribute('d');
  await page.locator('audio').evaluate(element => element.pause()); await page.waitForTimeout(600);
  const pausedLevel = await read('energy'); assert.ok(pausedLevel < .01);
  const pausedMouth = await page.locator('.avatar-face__mouth').getAttribute('d');
  assert.notEqual(activeMouth, pausedMouth);
  result.audio = { activeLevel, pausedLevel, activeMouth, pausedMouth, source: 'WAV PCM local de 440 Hz analizado con Web Audio; no proveedor TTS remoto' };
  check('Amplitud medida desde un archivo real y caída a cero al pausar');
  const registers = [];
  for (const signal of [{ hz: 140, amplitude: .04 }, { hz: 480, amplitude: .25 }]) {
    await page.locator('input[type="file"]').setInputFiles({ name: `registro-${signal.hz}.wav`, mimeType: 'audio/wav', buffer: voiceWav(signal.hz, signal.amplitude) });
    await page.getByRole('button', { name: 'Escuchando', exact: true }).click();
    await page.locator('audio').evaluate(element => element.play());
    await page.waitForTimeout(850);
    registers.push({ ...signal, tone: await read('tone'), energy: await read('energy'), bass: await read('wave-0'), middle: await read('wave-1') });
    await page.locator('audio').evaluate(element => element.pause());
  }
  assert.ok(registers[1].tone > registers[0].tone + .3);
  assert.ok(registers[1].energy > registers[0].energy + .2);
  assert.ok(registers[0].bass > registers[1].bass);
  result.audio.registers = registers;
  check('Escucha reactiva a WAV grave/suave y agudo/fuerte con el analizador de producción');
  await page.getByRole('button', { name: 'Restablecer', exact: true }).click();

  const states = [ ['idle', 'En espera'], ['listening', 'Escuchando'], ['thinking', 'Pensando'], ['speaking', 'Respondiendo'], ['success', 'Éxito'], ['warning', 'Advertencia'], ['curious', 'Curiosidad'], ['happy', 'Alegría'], ['confused', 'Duda'], ['focused', 'Concentración'], ['acknowledging', 'Confirmación'], ['sleeping', 'En reposo'], ['surprised', 'Sorpresa'], ['concerned', 'Preocupación'] ];
  const frames = []; const tiles = []; const automaticGestures = [];
  await page.addStyleTag({ content: '.preview-avatar { background: #091b2b; }' });
  for (const [state, label] of states) {
    await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(300);
    assert.equal(await avatar.getAttribute('data-expression'), state);
    await slider('Amplitud de demostración', 0);
    // Medir el asentimiento tras la transición suave desde la pose anterior.
    if (state === 'acknowledging') await page.waitForTimeout(500);
    const poses = [];
    for (let sample = 0; sample < 5; sample++) {
      await page.waitForTimeout(120);
      poses.push(await rig.evaluate(element => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        const face = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.avatar-face')).transform);
        return { x: matrix.e, y: matrix.f, rotation: matrix.b, faceY: face.f };
      }));
    }
    assert.ok(new Set(poses.map(pose => pose.y)).size > 1, `El estado ${state} debe moverse sin interacción ni audio.`);
    assert.equal(await read('energy'), 0);
    if (state === 'acknowledging') {
      assert.equal(await page.locator('.avatar-face__ack-badge').count(), 0);
      assert.ok(poses.every(pose => Math.abs(pose.x) < .01 && Math.abs(pose.rotation) < .001));
      const faceRange = Math.max(...poses.map(pose => pose.faceY)) - Math.min(...poses.map(pose => pose.faceY));
      const bodyRange = Math.max(...poses.map(pose => pose.y)) - Math.min(...poses.map(pose => pose.y));
      assert.ok(faceRange > bodyRange * 4, 'El asentimiento debe mover principalmente el rostro.');
    }
    if (state === 'sleeping') {
      assert.equal(await page.locator('.soflia-avatar__sleep-cues span').count(), 3);
      assert.equal(await page.locator('.soflia-avatar__rig .soflia-avatar__sleep-cues').count(), 0);
    }
    automaticGestures.push({ state, poses });
    for (let frame = 0; frame < 6; frame++) {
      if (state === 'listening' || state === 'speaking') await slider('Amplitud de demostración', [.1, .7, .3, .9, .2, .6][frame]);
      await page.mouse.move(250 + frame * 25, 420); await page.waitForTimeout(65);
      const png = await page.locator('.preview-avatar').screenshot({ animations: 'allow' });
      frames.push(png);
      if (frame === 2) {
        tiles.push({ input: await sharp(png).resize(256, 256).extend({ bottom: 28, background: '#091b2b' }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="284"><text x="128" y="273" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" fill="#eaf8fa">${label}</text></svg>`) }]).png().toBuffer(), left: (tiles.length % 4) * 256, top: Math.floor(tiles.length / 4) * 284 });
        const style = await page.addStyleTag({ content: 'html,body,main,.preview-avatar{background:transparent!important}.preview-orbit{visibility:hidden}' });
        await page.locator('.preview-avatar').screenshot({ path: path.join(exportsDirectory, `${state}.png`), omitBackground: true, animations: 'allow' });
        await style.evaluate(element => element.remove());
        const faceSvg = await page.locator('.avatar-face').evaluate(element => {
          const copy = element.cloneNode(true);
          copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '300'); copy.setAttribute('height', '300');
          copy.setAttribute('style', `color:${getComputedStyle(element).color}`);
          const sourceNodes = [element, ...element.querySelectorAll('*')]; const copiedNodes = [copy, ...copy.querySelectorAll('*')];
          for (let i = 1; i < sourceNodes.length; i++) {
            const css = getComputedStyle(sourceNodes[i]);
            copiedNodes[i].setAttribute('style', `stroke:${css.stroke};stroke-width:${css.strokeWidth};stroke-dasharray:${css.strokeDasharray};fill:${css.fill};opacity:${css.opacity};transform:${css.transform};transform-origin:${css.transformOrigin};transform-box:${css.transformBox}`);
          }
          return new XMLSerializer().serializeToString(copy);
        });
        await fs.writeFile(path.join(exportsDirectory, `${state}.svg`), faceSvg);
      }
    }
  }
  check('Catorce expresiones, con Sorpresa y Preocupación, exportadas desde el componente');
  check('Catorce gestos autónomos; confirmación facial y letras de sueño fuera del cuerpo');
  await sharp({ create: { width: 1024, height: Math.ceil(states.length / 4) * 284, channels: 4, background: '#091b2b' } }).composite(tiles).png().toFile(path.join(exportsDirectory, 'expressions.png'));
  const rawFrames = await Promise.all(frames.map(frame => sharp(frame).ensureAlpha().raw().toBuffer()));
  await sharp(Buffer.concat(rawFrames), { raw: { width: 360, height: 360 * frames.length, channels: 4, pageHeight: 360 } }).gif({ delay: 83, loop: 0, effort: 3 }).toFile(path.join(exportsDirectory, 'avatar-demo.gif'));
  await page.getByRole('button', { name: 'Confirmación', exact: true }).click();
  const nodFrames = [];
  for (let frame = 0; frame < 48; frame++) {
    await page.waitForTimeout(75);
    nodFrames.push(await sharp(await page.locator('.preview-avatar').screenshot({ animations: 'allow' })).ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(nodFrames), { raw: { width: 360, height: 360 * nodFrames.length, channels: 4, pageHeight: 360 } }).gif({ delay: 83, loop: 0, effort: 3 }).toFile(path.join(exportsDirectory, 'acknowledging-demo.gif'));
  const webm = await page.evaluate(async frameData => {
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 360;
    const context = canvas.getContext('2d');
    const images = await Promise.all(frameData.map(data => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = `data:image/png;base64,${data}`; })));
    const stream = canvas.captureStream(0); const track = stream.getVideoTracks()[0];
    const chunks = []; const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const done = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data); recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); resolve(btoa(binary)); }; });
    recorder.start();
    for (const image of images) { context.drawImage(image, 0, 0); track.requestFrame(); await new Promise(resolve => setTimeout(resolve, 83)); }
    recorder.stop(); track.stop(); return done;
  }, frames.map(frame => frame.toString('base64')));
  await fs.writeFile(path.join(exportsDirectory, 'avatar-demo.webm'), Buffer.from(webm, 'base64'));
  result.assets = { frameCount: frames.length, exportFps: 12, confirmationFrames: nodFrames.length, automaticGestures, note: 'Exportaciones de presentación a 12 fps; el componente mantiene su propio RAF.' };
  assert.deepEqual(failures, []);
  await fs.writeFile(path.join(reports, 'browser-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
