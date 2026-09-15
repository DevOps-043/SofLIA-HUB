import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('json5').parse(readFileSync(resolve('electron-builder.json5'), 'utf8'));
const ui = readFileSync(resolve('build/installer.nsh'), 'utf8');

describe('contrato visual y seguridad del instalador Pulse Hub', () => {
  it('conserva instalación asistida, elección de destino y datos al desinstalar', () => {
    expect(config.nsis).toMatchObject({ oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false, installerLanguages: ['es_ES'] });
    expect(config.nsis.include).toBe('build/installer.nsh');
    expect(config.afterPack).toBe('scripts/verify-packaged-python.cjs');
  });

  it('usa bienvenida propia con texto nativo, imagen decorativa y recursos liberados', () => {
    expect(ui).toContain('!macro customWelcomePage');
    expect(ui).toContain('${NSD_CreateLabel}');
    expect(ui).toContain('${NSD_FreeImage} $PulseArtworkHandle');
    expect(ui).toContain('gdi32::DeleteObject(p $PulseTitleFont)');
    expect(ui).toContain('Sin modificar el Python de tu equipo.');
    expect(ui).toContain('Call muiPageUnloadFullWindow');
  });

  it('no activa apertura implícita ni descarga Python dentro del asistente', () => {
    expect(ui).toContain('!define MUI_FINISHPAGE_RUN_NOTCHECKED');
    expect(ui).toContain('ShowInstDetails hide');
    expect(ui).not.toMatch(/(?:ExecWait|inetc::|nsisdl::|WriteRegStr)/i);
    expect(config.nsis.runAfterFinish).toBe(true); // Opción visible, desmarcada por NSIS.
  });

  it.each([
    ['welcome-scene.bmp', 540, 870],
    ['installerHeader.bmp', 150, 57],
    ['installerSidebar.bmp', 164, 314],
    ['uninstallerSidebar.bmp', 164, 314],
  ])('el recurso %s tiene BMP 24-bit íntegro y tamaño esperado', (file, width, height) => {
    const bitmap = readFileSync(resolve('build/installer', file));
    expect(bitmap.toString('ascii', 0, 2)).toBe('BM');
    expect(bitmap.readUInt32LE(2)).toBe(bitmap.length);
    expect(bitmap.readUInt32LE(10)).toBe(54);
    expect(bitmap.readInt32LE(18)).toBe(width);
    expect(bitmap.readInt32LE(22)).toBe(height);
    expect(bitmap.readUInt16LE(28)).toBe(24);
    expect(bitmap.length).toBe(54 + Math.ceil(Number(width) * 3 / 4) * 4 * Number(height));
  });
});
