import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build, Platform, Arch } from 'electron-builder';
import { compileApp, projectRoot, runBuildCommand } from './smoke-app-build.mjs';
import { inspectInstaller, installerArtifact, installerEnvironment } from './smoke-installer-win.mjs';

export const learningQaOrigin = 'https://codex-complete-synchronous-system--soflia-learning.netlify.app';
const version = '0.9.9-sync.20261107';
const branch = 'refs/heads/codex/complete-synchronous-system';

export function publicQaConfig(env) {
  const config = {
    VITE_LEARNING_BASE_URL: learningQaOrigin,
    VITE_LEARNING_SSO_ENABLED: 'true',
  };
  for (const prefix of ['VITE_SUPABASE', 'VITE_SOFIA_SUPABASE']) {
    const urlName = `${prefix}_URL`;
    const keyName = `${prefix}_ANON_KEY`;
    const origin = env[urlName]?.trim() ?? '';
    const project = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(origin)?.[1];
    assert.ok(project, `Falta un origen público válido en ${urlName}.`);
    const key = env[keyName]?.trim() ?? '';
    let isPublic = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
    if (!isPublic && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) {
      try {
        const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
        isPublic = claims.role === 'anon' && claims.ref === project;
      } catch {
        isPublic = false;
      }
    }
    assert.ok(isPublic, `Falta una clave pública del proyecto en ${keyName}.`);
    config[urlName] = origin;
    config[keyName] = key;
  }
  return config;
}

async function main() {
  assert.equal(process.platform, 'win32');
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_REF, branch);
  assert.match(process.env.GITHUB_SHA ?? '', /^[0-9a-f]{40}$/);
  assert.ok(!fs.readdirSync(projectRoot).some(name => /^\.env(?:$|\.)/.test(name) && !name.endsWith('.example')),
    'La compilación QA requiere un checkout sin archivos de entorno.');
  const config = publicQaConfig(process.env);
  const env = { ...installerEnvironment(process.env), ...config };
  assert.equal(await compileApp(projectRoot, env), 0, 'Falló la compilación de QA.');
  assert.equal(await runBuildCommand(projectRoot, ['scripts/generate-bitmaps.js'], env), 0);

  // El empaquetador recibe el bundle compilado y no necesita valores de conexión.
  for (const name of Object.keys(config)) delete process.env[name];
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  const output = `release/${version}`;
  const artifact = installerArtifact(version);
  await build({
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
    publish: 'never',
    config: {
      publish: null,
      directories: { output },
      extraMetadata: { version },
      win: { artifactName: path.basename(artifact) },
      nsis: { differentialPackage: false, useZip: true },
    },
  });

  const require = createRequire(import.meta.url);
  const asar = require('@electron/asar');
  const resources = path.join(output, 'win-unpacked', 'resources');
  const archive = path.join(resources, 'app.asar');
  const entries = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
  assert.ok(!entries.some(file => /(?:^|\/)(?:AGENTS\.md|SKILL\.md|\.env(?:\.[^/]*)?)$/i.test(file)),
    'El paquete contiene archivos de desarrollo o de entorno.');
  assert.ok(!fs.existsSync(path.join(resources, 'app-update.yml')), 'QA no debe incluir un feed de actualizaciones.');
  const metadata = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  assert.equal(metadata.version, version);
  const preload = asar.extractFile(archive, 'dist-electron/preload.js').toString();
  assert.ok(preload.includes(config.VITE_SUPABASE_URL) && preload.includes(config.VITE_SUPABASE_ANON_KEY),
    'Falta la configuración de autenticación en el preload empaquetado.');
  const appBundles = entries.filter(file => /^dist\/assets\/[^/]+\.js$/.test(file));
  const renderer = appBundles.map(file => asar.extractFile(archive, file).toString()).join('\n');
  const mainBundle = asar.extractFile(archive, metadata.main).toString();
  assert.ok(renderer.includes(learningQaOrigin) && mainBundle.includes(learningQaOrigin),
    'Falta el origen de Learning QA en la aplicación empaquetada.');
  assert.ok(renderer.includes(config.VITE_SOFIA_SUPABASE_URL) && renderer.includes(config.VITE_SOFIA_SUPABASE_ANON_KEY),
    'Falta la configuración pública de Sofía en el renderer empaquetado.');
  const installer = await inspectInstaller(artifact);
  fs.writeFileSync(path.join(output, 'testing-package.json'), JSON.stringify({
    version, sourceCommit: process.env.GITHUB_SHA, learningQaOrigin, publicConfigVerified: true,
    ...installer, file: path.basename(installer.file),
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${installer.sha256}  ${path.basename(artifact)}\n`);
  console.log(`Instalador de QA verificado. SHA-256 ${installer.sha256}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
