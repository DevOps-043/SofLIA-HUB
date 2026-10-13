import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const builder = require('json5').parse(readFileSync(resolve('electron-builder.json5'), 'utf8'));

describe('recursos de marca y distribución de Soflia Hub', () => {
  it('mantiene la proporción vertical y transparencia del logo', async () => {
    const logo = await sharp('public/assets/Icono.png').metadata();
    expect(logo).toMatchObject({ width: 750, height: 943, hasAlpha: true });
    const master = await sharp('public/assets/icon.png').metadata();
    expect(master).toMatchObject({ width: 1024, height: 1024, hasAlpha: true });
    const { data } = await sharp('public/assets/icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it('incluye tamaños Windows cuadrados y el frame de 256 requerido por NSIS', () => {
    const ico = readFileSync(resolve('public/assets/icono.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    const sizes: number[] = [];
    for (let i = 0; i < ico.readUInt16LE(4); i++) {
      const offset = 6 + 16 * i;
      const width = ico[offset] || 256;
      expect(ico[offset + 1] || 256).toBe(width);
      expect(ico.readUInt32LE(offset + 12) + ico.readUInt32LE(offset + 8)).toBeLessThanOrEqual(ico.length);
      sizes.push(width);
    }
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 24, 32, 48, 64, 128, 256]);
  });

  it('renombra distribución y conserva la identidad del actualizador', () => {
    expect(builder.productName).toBe('Soflia Hub');
    expect(builder.appId).toBe('com.pulsehub.sofliahub');
    expect(builder.publish[0].repo).toBe('PulseHub-SofLIA-releases');
    expect(builder.nsis.shortcutName).toBe('Soflia Hub');
    for (const platform of ['win', 'mac', 'linux']) expect(builder[platform].artifactName).toMatch(/^Soflia-Hub-/);
    expect(readFileSync(resolve('index.html'), 'utf8')).toContain('<title>Soflia Hub</title>');
  });
});
