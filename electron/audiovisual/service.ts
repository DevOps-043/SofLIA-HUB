import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { filmSchema, type Film } from '../../src/shared/audiovisual/film-schema';
import { filmFrameSvg } from '../../src/shared/audiovisual/frame';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import { mediaProcess } from './process';
import { synthesizeAudio } from './audio';
import { resolveMediaRuntime } from './runtime';

export const filmHash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export class AudiovisualService {
  private active: { id: string; controller: AbortController } | null = null;
  constructor(private readonly workspace: SkillWorkspaceService, private readonly root: string, private readonly resources?: string) {}
  cancel(id: string): boolean { if (this.active?.id !== id) return false; this.active.controller.abort(); return true; }
  stop(): void { this.active?.controller.abort(); }
  async render(id: string): Promise<{ frames: number; path: string }> {
    if (this.active) throw new Error('Ya hay una producción audiovisual en curso.');
    const controller = new AbortController(); this.active = { id, controller };
    const timer = setTimeout(() => controller.abort(), 12 * 60 * 1000);
    let temporary: string | undefined;
    try {
      const workspace = await this.workspace.getWorkspace(id);
      if (workspace?.skillId !== 'sistema:audiovisual') throw new Error('El workspace no pertenece a la skill audiovisual.');
      const source = await this.workspace.readFile(id, 'film.json'); if (!source.ok) throw new Error(source.error);
      const film = filmSchema.parse(JSON.parse(source.data)), hash = filmHash(source.data);
      const guard = async () => {
        if (controller.signal.aborted) throw new Error('Producción cancelada.');
        const current = await this.workspace.readFile(id, 'film.json');
        if (!current.ok || filmHash(current.data) !== hash) throw new Error('film.json cambió durante el render. Vuelve a producir la revisión actual.');
      };
      const runtime = await resolveMediaRuntime(this.root, this.resources);
      for (const exe of [runtime.ffmpeg, runtime.ffprobe]) await mediaProcess(exe, ['-version'], controller.signal);
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-film-'));
      const audio = path.join(temporary, 'audio.wav'), output = path.join(temporary, 'video.mp4');
      await fs.writeFile(audio, synthesizeAudio(film.fotogramas / film.fps, film.semilla, film.audio === 'silencio'));
      let cached = '', png = Buffer.alloc(0);
      await mediaProcess(runtime.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(film.fps), '-i', 'pipe:0', '-i', audio, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(film.fps), '-frames:v', String(film.fotogramas), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-af', film.audio === 'silencio' ? 'anull' : 'loudnorm=I=-14:TP=-2:LRA=11', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', '-t', String(film.fotogramas / film.fps), '-movflags', '+faststart', '-fs', String(80 * 1024 * 1024), output], controller.signal, async write => {
        for (let frame = 0; frame < film.fotogramas; frame++) {
          if (controller.signal.aborted) throw new Error('Producción cancelada.');
          const svg = filmFrameSvg(film, frame);
          if (svg !== cached) { png = await sharp(Buffer.from(svg)).png().toBuffer(); cached = svg; }
          await write(png);
          if (frame % film.fps === 0) { await guard(); this.workspace.emit('progreso', { workspaceId: id, operation: 'escritura', path: 'salida/video.mp4', status: 'en_curso', message: `Renderizando ${frame + 1}/${film.fotogramas} fotogramas` }); }
        }
      });
      await guard();
      const report = await verifyVideo(runtime, output, film, controller.signal);
      await guard();
      const buffer = await fs.readFile(output);
      if (!buffer.length || buffer.length > 80 * 1024 * 1024) throw new Error('MP4 fuera del límite de 80 MB.');
      const previousVideoPath = await this.workspace.resolveAbsolutePath(id, 'salida/video.mp4');
      const previousReport = await this.workspace.readFile(id, 'qa/informe.json');
      const previousVideo = previousVideoPath ? await fs.readFile(previousVideoPath) : null;
      await guard();
      try {
      const binary = await this.workspace.writeSystemBinary(id, 'salida/video.mp4', buffer);
      if (!binary.ok) throw new Error(binary.error);
      await guard();
      const qa = await this.workspace.writeSystemFile(id, 'qa/informe.json', JSON.stringify({ ok: true, ...report, filmHash: hash, videoHash: filmHash(buffer), bytes: buffer.length }, null, 2));
      if (!qa.ok) throw new Error(qa.error);
      await guard();
      } catch (error) {
        try {
          if (previousVideo) { const restored = await this.workspace.writeSystemBinary(id, 'salida/video.mp4', previousVideo); if (!restored.ok) throw Object.assign(new Error(restored.error), { cause: error }); }
          else await this.workspace.removeSystemExport(id, 'salida/video.mp4');
          if (previousReport.ok) { const restored = await this.workspace.writeSystemFile(id, 'qa/informe.json', previousReport.data); if (!restored.ok) throw Object.assign(new Error(restored.error), { cause: error }); }
          else await this.workspace.removeSystemExport(id, 'qa/informe.json');
        } catch (restorationError) { throw Object.assign(new Error(`No se pudo restaurar la publicación anterior: ${restorationError instanceof Error ? restorationError.message : 'error de disco'}`), { cause: error }); }
        throw error;
      }
      this.workspace.emit('progreso', { workspaceId: id, operation: 'escritura', path: 'salida/video.mp4', status: 'completado', bytes: buffer.length });
      return { frames: film.fotogramas, path: 'salida/video.mp4' };
    } catch (error) {
      this.workspace.emit('progreso', { workspaceId: id, operation: 'escritura', path: 'salida/video.mp4', status: 'error', message: error instanceof Error ? error.message : 'No se pudo producir el video.' });
      throw error;
    } finally { clearTimeout(timer); this.active = null; if (temporary) await fs.rm(temporary, { recursive: true, force: true }); }
  }
}

export async function verifyVideo(runtime: { ffmpeg: string; ffprobe: string }, file: string, film: Film, signal: AbortSignal) {
  const raw = await mediaProcess(runtime.ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], signal);
  const probe = JSON.parse(raw), video = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video'), audio = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
  if (!video || video.codec_name !== 'h264' || video.width !== film.ancho || video.height !== film.ancho * 9 / 16 || video.r_frame_rate !== `${film.fps}/1` || Number(video.nb_read_frames) !== film.fotogramas || !Number.isFinite(Number(probe.format?.duration)) || Math.abs(Number(probe.format.duration) - film.fotogramas / film.fps) > .05 || audio?.codec_name !== 'aac' || audio?.sample_rate !== '48000' || audio?.channels !== 2) throw new Error('El video no cumple el perfil técnico.');
  const pts = JSON.parse(await mediaProcess(runtime.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', file], signal)).frames;
  if (pts.length !== film.fotogramas || pts.some((f: { best_effort_timestamp_time: string }, i: number) => !Number.isFinite(Number(f.best_effort_timestamp_time)) || Math.abs(Number(f.best_effort_timestamp_time) - i / film.fps) > .00001)) throw new Error('Cadencia o timestamps de video inválidos.');
  await mediaProcess(runtime.ffmpeg, ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], signal);
  let loudness: { lufs: number; pico: number } | null = null;
  if (film.audio !== 'silencio') {
    const measured = await mediaProcess(runtime.ffmpeg, ['-hide_banner', '-i', file, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], signal, undefined, true);
    const json = measured.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)?.pop();
    if (!json) throw new Error('No se pudo medir la sonoridad del AAC final.');
    const values = JSON.parse(json); loudness = { lufs: Number(values.input_i), pico: Number(values.input_tp) };
    if (!Number.isFinite(loudness.lufs) || Math.abs(loudness.lufs + 14) > 1 || !Number.isFinite(loudness.pico) || loudness.pico > -1) throw new Error('El AAC no cumple -14 ±1 LUFS y pico máximo -1 dBTP.');
  }
  return { loudness, frames: Number(video.nb_read_frames), fps: film.fps, ancho: video.width, alto: video.height, duracion: Number(probe.format.duration), timestamps: true, decodificacion: true, audio: film.audio };
}
