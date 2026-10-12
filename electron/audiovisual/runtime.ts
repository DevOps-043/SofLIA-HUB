import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from 'dotenv';

/** Las rutas se resuelven en main en ejecución; no se incrustan en el renderer. */
export async function resolveMediaRuntime(root: string, resources?: string): Promise<{ ffmpeg: string; ffprobe: string }> {
  config({ path: path.join(root, '.env.audiovisual.local'), override: false, quiet: true });
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const folder = path.join(resources ?? root, 'media-runtime');
  const ffmpeg = process.env.SOFLIA_FFMPEG_PATH?.trim() || path.join(folder, `ffmpeg${suffix}`);
  const ffprobe = process.env.SOFLIA_FFPROBE_PATH?.trim() || path.join(folder, `ffprobe${suffix}`);
  for (const file of [ffmpeg, ffprobe]) {
    if (!path.isAbsolute(file)) throw new Error('Las rutas de FFmpeg y FFprobe deben ser absolutas.');
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw new Error('Falta el motor audiovisual. Ejecuta npm run audiovisual:setup con rutas a FFmpeg y FFprobe.');
  }
  return { ffmpeg, ffprobe };
}
