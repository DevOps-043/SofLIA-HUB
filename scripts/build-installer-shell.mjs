import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { prepareOrbAssets } from './installer-orb-assets.mjs';
import { buildEnvironment } from './quality/smoke-app-build.mjs';

export const shellRoot = fileURLToPath(new URL('../', import.meta.url));
export function artifactNames(version) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/, 'Versión inválida.');
  return { engine: `Pulse-Hub-Windows-${version}-Setup.exe`, shell: `Pulse-Hub-Windows-${version}-Install.exe` };
}
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function compilerConfiguration() {
  assert.equal(process.platform, 'win32', 'La interfaz se compila en Windows con .NET Framework.');
  const framework = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319');
  const compiler = path.join(framework, 'csc.exe');
  assert.ok(fs.existsSync(compiler), 'Falta el compilador .NET Framework de Windows.');
  const references = ['PresentationFramework.dll', 'PresentationCore.dll', 'WindowsBase.dll'].map(name => `/reference:${path.join(framework, 'WPF', name)}`);
  return { compiler, references: [...references, '/reference:System.Xaml.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll', '/reference:System.IO.Compression.dll'] };
}

/** Compila una entrada distinta; jamás reemplaza el EXE/hash del actualizador. */
export async function buildInstallerShell({ root = shellRoot, preview = false, enginePath, outputDirectory } = {}) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const names = artifactNames(version);
  const source = path.join(root, 'build/installer-shell');
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-installer-shell-'));
  const engine = enginePath || path.join(root, 'release', version, names.engine);
  let hash = '0'.repeat(64);
  if (!preview) {
    const stat = fs.lstatSync(engine);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, 'Falta el motor NSIS regular.');
    hash = await sha256(engine);
  }
  const generated = path.join(stage, 'BuildInfo.cs');
  const orbAssets = await prepareOrbAssets(root, stage);
  fs.writeFileSync(generated, `namespace PulseInstaller { internal static class BuildInfo { public const string Version = "${version}"; public const string PayloadHash = "${hash}"; } }`, { flag: 'wx' });
  const output = outputDirectory || (preview ? stage : path.join(root, 'release', version));
  fs.mkdirSync(output, { recursive: true });
  const destination = path.join(output, preview ? 'Pulse-Hub-Installer-Preview.exe' : names.shell);
  assert.ok(!fs.existsSync(destination), 'El ejecutable de salida ya existe; usa una carpeta nueva para conservarlo.');
  const { compiler, references } = compilerConfiguration();
  const args = ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/codepage:65001', '/utf8output', ...references,
    `/out:${destination}`, `/win32manifest:${path.join(source, 'app.manifest')}`, `/win32icon:${path.join(root, 'public/assets/icono.ico')}`,
    `/resource:${path.join(source, 'window.xaml')},Pulse.Window`, `/resource:${path.join(root, 'public/assets/Icono.png')},Pulse.Logo`,
    `/resource:${path.join(root, 'public/assets/icono.ico')},Pulse.Icon`,
    `/resource:${orbAssets.archiveFile},Pulse.Orb`,
    `/resource:${path.join(orbAssets.sdk, 'runtimes/win-x64/native/WebView2Loader.dll')},Pulse.WebView2Loader`,
    ...['Core', 'Wpf'].flatMap(name => [
      `/reference:${path.join(orbAssets.sdk, `lib/net462/Microsoft.Web.WebView2.${name}.dll`)}`,
      `/resource:${path.join(orbAssets.sdk, `lib/net462/Microsoft.Web.WebView2.${name}.dll`)},Pulse.Microsoft.Web.WebView2.${name}`,
    ]),
    ...['InstallerWindow.cs', 'InstallService.cs', 'OrbScene.cs', 'EmbeddedAssets.cs'].map(file => path.join(source, file)), generated];
  if (preview) args.push('/define:PREVIEW');
  else args.push(`/resource:${engine},Pulse.Payload`);
  execFileSync(compiler, args, { cwd: root, windowsHide: true, stdio: 'pipe', timeout: 120000, env: buildEnvironment(process.env) });
  if (!preview) assert.equal(await sha256(engine), hash, 'El motor cambió durante la compilación. No distribuir el resultado.');
  const report = { file: destination, preview, engine: preview ? null : engine, payloadSha256: preview ? null : hash,
    sha256: await sha256(destination), bytes: fs.statSync(destination).size, logoSha256: await sha256(path.join(root, 'public/assets/Icono.png')),
    sdkSha256: orbAssets.sdkSha256, originalOrb: true, installed: false, published: false, signedByScript: false };
  fs.writeFileSync(path.join(stage, 'shell-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  return { ...report, report: path.join(stage, 'shell-report.json') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--preview'), 'Solo se admite --preview; no hay opciones de instalación o publicación.');
    if (process.platform !== 'win32' && args.length === 0) console.log('[Instalador] La entrada visual solo aplica a Windows.');
    else console.log(JSON.stringify(await buildInstallerShell({ preview: args[0] === '--preview' }), null, 2));
  } catch (error) {
    console.error(error.stdout?.toString() || error.message);
    process.exitCode = 1;
  }
}
