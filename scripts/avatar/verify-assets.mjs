import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const directory = fileURLToPath(new URL('../../src/assets/soflia-avatar/', import.meta.url));
const original = await fs.readFile(directory + 'original.png');
const provenance = JSON.parse(await fs.readFile(directory + 'provenance.json', 'utf8'));
assert.equal(createHash('sha256').update(original).digest('hex'), provenance.sha256);
const source = await sharp(original).ensureAlpha().raw().toBuffer();
const still = await sharp(directory + 'original-cutout.png').ensureAlpha().raw().toBuffer();
let visible = 0; let transparent = 0;
for (let i = 0; i < still.length; i += 4) {
  if (still[i + 3] === 0) transparent++;
  else {
    visible++;
    for (let channel = 0; channel < 3; channel++) assert.equal(still[i + channel], source[i + channel], 'El PNG estático debe conservar cada píxel RGB visible de la imagen aprobada.');
  }
}
assert.ok(visible > 500000 && transparent > 500000);
for (const name of ['body.png', 'eye-left.png', 'eye-right.png', 'light.png']) {
  const metadata = await sharp(directory + name).metadata();
  assert.equal(metadata.width, 1312); assert.equal(metadata.height, 1199); assert.equal(metadata.hasAlpha, true);
}
console.log(`Identidad comprobada: ${visible} píxeles visibles originales, ${transparent} transparentes y cuatro capas RGBA válidas.`);
