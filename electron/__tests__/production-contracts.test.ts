import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { filmSchema } from '../../src/shared/audiovisual/film-schema';
import { filmFrameSvg } from '../../src/shared/audiovisual/frame';
import filmFixture from '../../test/fixtures/audiovisual-film.json';
import deckFixture from '../../test/fixtures/production-deck.json';
import { synthesizeAudio } from '../audiovisual/audio';
import { AudiovisualService, verifyVideo, filmHash } from '../audiovisual/service';
import { createEditablePptx } from '../presentation-export/pptx';
import { readPresentationText } from '../background-teams/presentation-reader';
import { SkillWorkspaceService } from '../skill-workspace/service';
import { AUDIOVISUAL_SKILL } from '../../src/shared/skills/audiovisual-skill';
import { prepareFilmPreview } from '../audiovisual/preview';
import { videoRange } from '../skill-workspace/video-response';
import { mediaProcess } from '../audiovisual/process';

vi.mock('../audiovisual/process', () => ({ mediaProcess: vi.fn() }));
vi.mock('../audiovisual/runtime', () => ({ resolveMediaRuntime: async () => ({ ffmpeg: 'encoder', ffprobe: 'probe' }) }));
describe('contratos de producción y regresiones', () => {
  it('admite rangos de reproducción y rechaza rangos ambiguos o imposibles', () => { expect(videoRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 }); expect(videoRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 }); expect(videoRange('bytes=200-', 100)).toBeNull(); expect(videoRange('bytes=0-2,4-6', 100)).toBeNull(); });
  it('mantiene frames deterministas y escapa contenido de fuentes', () => {
    const film = filmSchema.parse(filmFixture); film.entidades[0].titulo = '<script>&';
    expect(filmFrameSvg(film, 500)).toBe(filmFrameSvg(film, 500));
    expect(filmFrameSvg(film, 0)).toContain('&lt;script&gt;&amp;');
    expect(filmFrameSvg(film, 0)).not.toContain('<script>');
  });
  it('rechaza código, referencias inexistentes, escenas discontinuas y cajas ilegibles', () => {
    expect(() => filmSchema.parse({ ...filmFixture, script: 'x' })).toThrow();
    const film = structuredClone(filmFixture); film.escenas[1].inicio++;
    expect(() => filmSchema.parse(film)).toThrow();
    const small = structuredClone(filmFixture); small.escenas[0].entidades[0].ancho = .16;
    expect(() => filmSchema.parse(small)).toThrow();
    const missing = structuredClone(filmFixture); missing.escenas[0].entidades[0].id = 'ajena';
    expect(() => filmSchema.parse(missing)).toThrow();
  });
  it('sintetiza PCM exacto, reproducible y silencio explícito', () => {
    const a = synthesizeAudio(1, 42, false); expect(a.length).toBe(44 + 48000 * 4);
    expect(a.equals(synthesizeAudio(1, 42, false))).toBe(true);
    expect(synthesizeAudio(1, 42, true).subarray(44).every(v => v === 0)).toBe(true);
  });
  it('produce PPTX real con tablas, textos y contenido heredado visible', async () => {
    const { buffer } = await createEditablePptx(deckFixture, 'Demo'); expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(readPresentationText(buffer)).toContain('Fotogramas y audio');
    const old = await createEditablePptx([{ title: 'Ingresos', stats: [{ value: '10', label: 'Ventas' }], quote: { text: 'Cita real', author: 'Fuente' }, leftColumn: { heading: 'Primero', items: ['Dato'] }, steps: [{ label: 'Revisar' }] }], 'Demo');
    const text = readPresentationText(old.buffer); for (const value of ['10', 'Ventas', 'Cita real', 'Fuente', 'Primero', 'Dato', 'Revisar']) expect(text).toContain(value);
  });
  it('verifica presentaciones paginadas y rechaza expansión excesiva', async () => { const result = await createEditablePptx(Array.from({ length: 6 }, () => ({ title: 'Contenido largo', body: 'a'.repeat(2500) })), 'Demo'); expect(result.slides).toBe(24); expect(readPresentationText(result.buffer)).toContain('Contenido largo'); await expect(createEditablePptx(Array.from({ length: 30 }, () => ({ title: 'Demasiado', body: 'a'.repeat(2500), bullets: Array.from({ length: 20 }, () => 'b'.repeat(2500)) })), 'Demo')).rejects.toThrow('120'); });
  it('rechaza imágenes que no puede resolver y JSON ambiguo', async () => {
    const deck = structuredClone(deckFixture) as Record<string, unknown>; const slides = deck.slides as Array<Record<string, unknown>>;
    slides[0].imagen = { src: 'assets/foto.png', alt: 'Fuente' };
    await expect(createEditablePptx(deck, 'Demo')).rejects.toThrow('recursos');
    await expect(createEditablePptx({ slides: [] }, 'Demo')).rejects.toThrow();
  });
  it('reserva un único render antes de cualquier await', async () => {
    let release!: () => void; const pause = new Promise<void>(ok => { release = ok; });
    const fake = { emit: vi.fn(), getWorkspace: vi.fn(async () => { await pause; return { skillId: 'otra' }; }) } as unknown as SkillWorkspaceService;
    const service = new AudiovisualService(fake, process.cwd());
    const first = service.render('demo'); const firstError = expect(first).rejects.toThrow('skill audiovisual');
    await expect(service.render('demo')).rejects.toThrow('en curso'); release(); await firstError;
    expect(fake.getWorkspace).toHaveBeenCalledTimes(1);
  });
  it('no acredita timestamps ausentes o duración no finita', async () => {
    const film = filmSchema.parse(filmFixture);
    vi.mocked(mediaProcess).mockResolvedValueOnce(JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '60/1', nb_read_frames: 1800 }, { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2 }], format: {} }));
    await expect(verifyVideo({ ffmpeg: 'a', ffprobe: 'b' }, 'demo', film, new AbortController().signal)).rejects.toThrow('perfil');
  });
  it('protege QA, invalida la entrega sin MP4 y no refresca preview en bucle', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'production-test-'));
    try {
      const service = new SkillWorkspaceService(root), created = await service.createWorkspace({ skillId: AUDIOVISUAL_SKILL.id, title: 'Demo', policy: AUDIOVISUAL_SKILL.workspace! });
      if (!created.ok) throw new Error(created.error); const id = created.data.id;
      expect((await service.writeFile(id, 'qa/informe.json', '{"ok":true}')).ok).toBe(false);
      expect((await service.writeFile(id, 'film.json', JSON.stringify(filmFixture))).ok).toBe(true);
      const progress = vi.fn(); service.on('progreso', progress);
      await prepareFilmPreview(service, id); await prepareFilmPreview(service, id); expect(progress).not.toHaveBeenCalled();
      const state = await service.getState(id); expect(state.ok && state.data.ready).toBe(false);
      expect((await service.writeSystemBinary(id, '../ajeno.mp4', Buffer.from('x'))).ok).toBe(false);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  it('restaura la publicación previa al cancelar durante la escritura del QA', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'production-rollback-'));
    try {
      const service = new SkillWorkspaceService(root), created = await service.createWorkspace({ skillId: AUDIOVISUAL_SKILL.id, title: 'Demo', policy: AUDIOVISUAL_SKILL.workspace! });
      if (!created.ok) throw new Error(created.error); const id = created.data.id;
      const source = JSON.stringify(filmFixture), previous = Buffer.from('video-anterior');
      await service.writeFile(id, 'film.json', source); await service.writeSystemBinary(id, 'salida/video.mp4', previous);
      const qa = JSON.stringify({ ok: true, filmHash: filmHash(source), videoHash: filmHash(previous), bytes: previous.length });
      await service.writeSystemFile(id, 'qa/informe.json', qa);
      const renderer = new AudiovisualService(service, process.cwd());
      vi.mocked(mediaProcess).mockReset().mockImplementation(async (_exe, args, _signal, input) => {
        if (args.includes('-version')) return 'versión';
        if (input) { await fs.writeFile(args[args.length - 1], Buffer.from('video-nuevo')); return ''; }
        if (args.includes('-show_streams')) return JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '60/1', nb_read_frames: 1800 }, { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2 }], format: { duration: '30' } });
        if (args.includes('-show_frames')) return JSON.stringify({ frames: Array.from({ length: 1800 }, (_, i) => ({ best_effort_timestamp_time: String(i / 60) })) });
        if (args.includes('-af')) return '{"input_i":"-14","input_tp":"-2"}';
        return '';
      });
      const write = service.writeSystemFile.bind(service); let cancelled = false;
      vi.spyOn(service, 'writeSystemFile').mockImplementation(async (...args) => { const result = await write(...args); if (args[1] === 'qa/informe.json' && !cancelled) { cancelled = true; renderer.cancel(id); } return result; });
      await expect(renderer.render(id)).rejects.toThrow('cancelada');
      const video = await service.resolveAbsolutePath(id, 'salida/video.mp4'); expect(await fs.readFile(video!)).toEqual(previous);
      expect(await service.readFile(id, 'qa/informe.json')).toEqual({ ok: true, data: qa });
      const state = await service.getState(id); expect(state.ok && state.data.ready).toBe(true);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
