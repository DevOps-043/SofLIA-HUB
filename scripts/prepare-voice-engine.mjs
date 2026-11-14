import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';
import { prepareVoiceModel } from './voice-engine-model.mjs';

const require = createRequire(import.meta.url);
const { runSigning, signingConfiguration } = require('./windows-signing.cjs');
export const voiceRoot = fileURLToPath(new URL('../', import.meta.url));

function archiveTree(zip, directory, prefix) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('El motor no puede contener enlaces.');
    if (entry.name === '__pycache__' || /\.(?:pyc|pyo)$/iu.test(entry.name) || entry.name === '.setup-lock.json') continue;
    const name = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) archiveTree(zip, source, name);
    else if (entry.isFile()) zip.file(source, { name });
    else throw new Error('El motor contiene una entrada no regular.');
  }
}

export async function prepareVoiceEngine(root = voiceRoot) {
  const windows = process.platform === 'win32';
  if (windows) { signingConfiguration(); runSigning('Check'); }
  execFileSync(process.execPath, [path.join(root, 'scripts/setup-python-runtime.js')], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, SOFLIA_REQUIRE_WINDOWS_SIGNING: windows ? '1' : '0' }, timeout: 50 * 60_000,
  });
  const model = await prepareVoiceModel(root);
  if (!windows) return { model };
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(version)) throw new Error('Versión de motor inválida.');
  const output = path.join(root, 'voice-engine'); fs.mkdirSync(output, { recursive: true });
  if (fs.lstatSync(output).isSymbolicLink()) throw new Error('El directorio del motor no puede ser un enlace.');
  const stage = fs.mkdtempSync(path.join(root, 'tmp', 'voice-engine-'));
  const archive = path.join(stage, 'engine.zip');
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(archive, { flags: 'wx' });
    const zip = new ZipArchive({ zlib: { level: 9 } });
    stream.on('close', resolve); stream.on('error', reject); zip.on('error', reject); zip.on('warning', reject);
    zip.pipe(stream);
    try {
      archiveTree(zip, path.join(root, 'python-runtime'), 'python');
      archiveTree(zip, path.join(root, 'python/sidecar'), 'python-sidecar');
      archiveTree(zip, path.join(root, 'python/tools_sidecar'), 'python-tools');
      archiveTree(zip, model, 'models/vosk-model-small-es-0.42');
      void zip.finalize().catch(reject);
    } catch (error) { zip.abort(); stream.destroy(); reject(error); }
  });
  const buildInfo = path.join(stage, 'BuildInfo.cs');
  fs.writeFileSync(buildInfo, `namespace SofliaVoiceEngine { internal static class BuildInfo { internal const string Version = "${version}"; } }`, { flag: 'wx' });
  const stagedExecutable = path.join(stage, 'Soflia-Voice-Engine.exe');
  const compiler = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/optimize+', '/codepage:65001',
    '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll',
    `/out:${stagedExecutable}`, `/win32manifest:${path.join(root, 'build/voice-engine/app.manifest')}`,
    `/resource:${archive},Soflia.VoiceEngine`, path.join(root, 'build/voice-engine/RestoreEngine.cs'), buildInfo],
  { cwd: root, windowsHide: true, stdio: 'inherit', timeout: 120000 });
  const signature = runSigning('SignFile', stagedExecutable, { requirePublisher: true });
  fs.copyFileSync(stagedExecutable, path.join(output, 'Soflia-Voice-Engine.exe'));
  fs.writeFileSync(path.join(output, 'descriptor.json'), JSON.stringify({ version, subject: signature.subject, publisher: signature.publisher }), 'utf8');
  return { model, repair: path.join(output, 'Soflia-Voice-Engine.exe') };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareVoiceEngine().then(() => console.log('[Motor de voz] Motor básico completo preparado.'))
    .catch(error => { console.error(`[Motor de voz] ${error.message}`); process.exitCode = 1; });
}
