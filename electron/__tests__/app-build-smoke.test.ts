import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const { isBuildSource, isInstallerSource, buildEnvironment } = await import(/* @vite-ignore */ pathToFileURL(resolve('scripts/quality/smoke-app-build.mjs')).href);
const { installerArguments, installerEnvironment, installerArtifact, hasEmbeddedSignature, inspectInstaller } = await import(/* @vite-ignore */ pathToFileURL(resolve('scripts/quality/smoke-installer-win.mjs')).href);

describe('build aislado sin credenciales', () => {
  it.each(['src/main.tsx', 'electron/main.ts', 'public/assets/icon.png', 'vite.config.mts', 'package.json', 'database/lia/supabase/functions/_shared/sofia-session-exchange-core.ts'])('incluye fuente %s', file => {
    expect(isBuildSource(file)).toBe(true);
  });
  it.each(['.env', '.env.production', 'src/.env', 'src/../.env', '/src/main.ts', 'C:/src/main.ts', 'src\\main.ts', 'src//main.ts', 'node_modules/paquete/index.js', 'src/node_modules/paquete/index.js', 'dist/index.html', 'release/app.exe', 'python-runtime/python.exe', '.git/config', 'database/lia/snapshot.sql', ''])('excluye archivo ajeno %s', file => {
    expect(isBuildSource(file)).toBe(false);
  });
  it('no propaga claves, flags de producto, hooks Node ni modo Electron', () => {
    expect(buildEnvironment({ SystemRoot: 'C:/Windows', PATH: 'C:/node', VITE_SECRET: 'no-copiar', ELEVENLABS_API_KEY: 'no-copiar', GH_TOKEN: 'no-copiar', NODE_OPTIONS: '--require externo', ELECTRON_RUN_AS_NODE: '1', BROWSER_SYNC_ENABLED: 'true' }))
      .toEqual({ SystemRoot: 'C:/Windows', PATH: 'C:/node' });
  });
});

describe('empaquetado Windows aislado sin instalación ni publicación', () => {
  const temporary: string[] = [];
  afterEach(() => { for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true }); });

  function executable(magic = 0x10b) {
    const buffer = Buffer.alloc(512);
    buffer.write('MZ');
    buffer.writeUInt32LE(128, 60);
    buffer.write('PE\0\0', 128);
    buffer.writeUInt16LE(magic === 0x10b ? 224 : 240, 148);
    buffer.writeUInt16LE(magic, 152);
    buffer.writeUInt32LE(16, 152 + (magic === 0x10b ? 92 : 108));
    return buffer;
  }

  it.each(['electron-builder.json5', 'build/installer.nsh', 'build/installer/sidebar.bmp', 'python/requirements.txt', 'python/tools_sidecar/main.py'])('copia fuentes de empaquetado %s sin ampliar app:smoke:build', file => {
    expect(isInstallerSource(file)).toBe(true);
    expect(isBuildSource(file)).toBe(false);
  });
  it.each(['.env', 'build/.env', 'python/.env.local', 'build/../.env', 'build//archivo.nsh', 'build\\archivo.nsh', 'build/release/app.exe', 'python/__pycache__/main.pyc', 'python/main.pyc', 'build/certificate.pfx', 'build/private.key', 'build/key.PEM', 'C:/build/installer.nsh', 'python-runtime/python.exe'])('excluye secretos, cachés y rutas inválidas %s', file => {
    expect(isInstallerSource(file)).toBe(false);
  });
  it('fija NSIS x64, publicación desactivada y conserva recursos sin firmar', () => {
    expect(installerArguments).toEqual(['--win', 'nsis', '--x64', '--publish', 'never', '--config.win.signExecutable=false']);
    expect(Object.isFrozen(installerArguments)).toBe(true);
    expect(installerEnvironment({ PATH: 'C:/node', GH_TOKEN: 'privado', CSC_LINK: 'privado', CSC_IDENTITY_AUTO_DISCOVERY: 'true', NODE_OPTIONS: 'externo', PYTHONPATH: 'externo' }))
      .toEqual({ PATH: 'C:/node', CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
  });
  it('deriva un único artefacto esperado sin aceptar traversal', () => {
    expect(installerArtifact('0.9.8')).toBe('release/0.9.8/Pulse-Hub-Windows-0.9.8-Setup.exe');
    expect(installerArtifact('1.2.3-rc.1')).toContain('1.2.3-rc.1');
    expect(() => installerArtifact('../release')).toThrow();
    expect(() => installerArtifact('1.2.3/otro')).toThrow();
  });
  it.each([0x10b, 0x20b])('acepta PE válido sin firma con formato %s', magic => {
    expect(hasEmbeddedSignature(executable(magic))).toBe(false);
  });
  it.each([0x10b, 0x20b])('detecta directorio Authenticode de formato %s', magic => {
    const buffer = executable(magic);
    buffer.writeUInt32LE(512, 152 + (magic === 0x10b ? 96 : 112) + 32);
    expect(hasEmbeddedSignature(buffer)).toBe(true);
  });
  it('rechaza archivos vacíos, truncados y formatos desconocidos', () => {
    expect(() => hasEmbeddedSignature(Buffer.alloc(0))).toThrow();
    expect(() => hasEmbeddedSignature(executable().subarray(0, 180))).toThrow();
    const invalid = executable();
    invalid.writeUInt16LE(0, 152);
    expect(() => hasEmbeddedSignature(invalid)).toThrow();
    invalid.writeUInt32LE(0xffffffff, 60);
    expect(() => hasEmbeddedSignature(invalid)).toThrow();
  });
  it('rechaza tablas PE sin directorio de certificados', () => {
    const buffer = executable();
    buffer.writeUInt32LE(4, 244);
    expect(() => hasEmbeddedSignature(buffer)).toThrow();
  });
  it('emite tamaño y SHA256 del EXE sin ejecutarlo y rechaza uno firmado', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-installer-test-'));
    temporary.push(directory);
    const file = path.join(directory, 'fixture.exe');
    const buffer = executable();
    fs.writeFileSync(file, buffer);
    await expect(inspectInstaller(file)).resolves.toEqual({ file, bytes: 512, sha256: createHash('sha256').update(buffer).digest('hex'), embeddedSignature: false });
    buffer.writeUInt32LE(512, 280);
    fs.writeFileSync(file, buffer);
    await expect(inspectInstaller(file)).rejects.toThrow('firma Authenticode');
  });
});
