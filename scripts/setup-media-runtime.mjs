import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// La instalación es explícita: nunca descarga o ejecuta código elegido por el modelo.
const root = process.cwd(), folder = path.join(root, 'media-runtime');
const suffix = process.platform === 'win32' ? '.exe' : '';
const args = process.argv.slice(2);
const source = { ffmpeg: args[0] || process.env.SOFLIA_FFMPEG_PATH, ffprobe: args[1] || process.env.SOFLIA_FFPROBE_PATH };
await fs.mkdir(folder, { recursive: true });
const manifest = { platform: process.platform, arch: process.arch, files: [] };
for (const [name, file] of Object.entries(source)) {
  if (!file || !path.isAbsolute(file)) throw new Error(`Indica la ruta absoluta de ${name}: npm run audiovisual:setup -- <ffmpeg> <ffprobe>`);
  const version = execFileSync(file, ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  if (!version.startsWith(name + ' version')) throw new Error(`El ejecutable no es ${name}.`);
  const target = path.join(folder, name + suffix);
  if (path.resolve(file) !== target) await fs.copyFile(file, target);
  if (process.platform !== 'win32') await fs.chmod(target, 0o755);
  manifest.files.push({ name: name + suffix, version: version.split('\n')[0], sha256: createHash('sha256').update(await fs.readFile(target)).digest('hex') });
  // Soporte de distribuciones compartidas de Windows.
  for (const entry of await fs.readdir(path.dirname(file))) if (/\.dll$/i.test(entry)) { const dllSource = path.join(path.dirname(file), entry), dllTarget = path.join(folder, entry); if (path.resolve(dllSource) !== dllTarget) await fs.copyFile(dllSource, dllTarget); }
}
const encoders = execFileSync(path.join(folder, 'ffmpeg' + suffix), ['-hide_banner', '-encoders'], { encoding: 'utf8', windowsHide: true });
if (!/\blibx264\b/.test(encoders) || !/\baac\b/.test(encoders)) throw new Error('La distribución requiere libx264 y AAC.');
await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
const local = path.join(root, '.env.audiovisual.local');
const env = `# Configuración local audiovisual; no contiene credenciales.\nVITE_SKILL_AUDIOVISUAL_ENABLED=true\nSOFLIA_FFMPEG_PATH=${path.join(folder, 'ffmpeg' + suffix).replace(/\\/g, '/')}\nSOFLIA_FFPROBE_PATH=${path.join(folder, 'ffprobe' + suffix).replace(/\\/g, '/')}\n`;
try { await fs.writeFile(local, env, { flag: 'wx' }); console.info('Variables audiovisuales locales creadas.'); }
catch (error) { if (error.code !== 'EEXIST') throw error; console.info('Se conserva la configuración audiovisual local existente.'); }
console.info('Runtime audiovisual verificado. Reinicia el proceso de desarrollo para cargar la bandera.');
