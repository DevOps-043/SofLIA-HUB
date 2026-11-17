import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { download } from './python-runtime-download.mjs';

export async function setupWindowsSigning(root = fileURLToPath(new URL('../', import.meta.url))) {
  if (process.platform !== 'win32') throw new Error('La preparación de firma requiere Windows.');
  if (process.env.SOFLIA_SIGNING_PROVIDER === 'certificate-store') return null;
  if (process.env.SOFLIA_SIGNING_PROVIDER !== 'azure') throw new Error('Configura SOFLIA_SIGNING_PROVIDER.');
  const { signingClient } = JSON.parse(fs.readFileSync(path.join(root, 'config/voice-engine.json'), 'utf8'));
  const directory = path.join(root, 'tmp', `artifact-signing-${signingClient.version}`);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('La caché de firma no puede ser un enlace.');
  const archive = path.join(directory, 'client.zip');
  if (!fs.existsSync(archive)) await download(signingClient.url, archive);
  if (createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== signingClient.sha256) throw new Error('El cliente de firma no coincide con el SHA256 fijado.');
  const extracted = fs.mkdtempSync(path.join(directory, 'sdk-'));
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/tar.exe'), ['-xf', archive, '-C', extracted], { windowsHide: true, timeout: 60000 });
  const dlib = path.join(extracted, 'bin/x64/Azure.CodeSigning.Dlib.dll');
  if (!fs.statSync(dlib).isFile()) throw new Error('No se encontró el dlib x64 de firma.');
  const receipt = path.join(directory, 'dlib-path.txt');
  fs.writeFileSync(receipt, dlib, 'utf8');
  console.log('[Firma Windows] Cliente de Artifact Signing verificado por SHA256.');
  return { dlib, receipt };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupWindowsSigning().then(result => { if (result) console.log(`[Firma Windows] Recibo público: ${result.receipt}`); })
    .catch(error => { console.error(`[Firma Windows] ${error.message}`); process.exitCode = 1; });
}
