import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { download } from './python-runtime-download.mjs';

export const modelFiles = Object.freeze(['conf/model.conf', 'am/final.mdl', 'graph/HCLr.fst']);
export function assertModel(directory) {
  for (const relative of modelFiles) {
    const file = path.join(directory, relative);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error('El modelo español básico está incompleto.');
  }
}
export async function prepareVoiceModel(root) {
  const { model } = JSON.parse(fs.readFileSync(path.join(root, 'config/voice-engine.json'), 'utf8'));
  const cache = path.join(root, 'tmp/voice-model'); fs.mkdirSync(cache, { recursive: true });
  if (fs.lstatSync(cache).isSymbolicLink()) throw new Error('La caché del modelo no puede ser un enlace.');
  const archive = path.join(cache, 'spanish.zip');
  if (!fs.existsSync(archive)) await download(model.url, archive);
  if (createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== model.sha256) throw new Error('SHA256 del modelo español incorrecto.');
  const stage = fs.mkdtempSync(path.join(cache, 'extract-'));
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/tar.exe') : 'tar';
  execFileSync(tar, ['-xf', archive, '-C', stage], { windowsHide: true, timeout: 180000 });
  const extracted = path.join(stage, model.directory); assertModel(extracted);
  const models = path.join(root, 'models'); fs.mkdirSync(models, { recursive: true });
  if (fs.lstatSync(models).isSymbolicLink()) throw new Error('El directorio de modelos no puede ser un enlace.');
  const destination = path.join(models, model.directory);
  if (fs.existsSync(destination)) {
    if (fs.lstatSync(destination).isSymbolicLink()) throw new Error('El modelo de destino no puede ser un enlace.');
    fs.renameSync(destination, path.join(stage, 'previous-model'));
  }
  fs.renameSync(extracted, destination);
  return destination;
}
