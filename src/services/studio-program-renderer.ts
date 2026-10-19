import { countdownText, PROGRAM_FPS, PROGRAM_HEIGHT, PROGRAM_WIDTH, type StudioTransition } from '../shared/studio-program';
import type { StudioPreparedScene } from '../components/learning-live/instructor/studio-types';

export type ProgramSource = { draw(ctx: CanvasRenderingContext2D, now: number): void; close(): void };

/** Un lienzo y una pista estables; las fuentes cambian dentro de la composición. */
export class StudioProgramRenderer {
  readonly canvas: HTMLCanvasElement;
  private current: ProgramSource | null = null;
  private next: { source: ProgramSource; bridge?: ProgramSource; reducedMotion: boolean; start: number; transition: StudioTransition; done(): void; reject(error: Error): void } | null = null;
  private frame = 0;
  private stream: MediaStream | null = null;
  private lastFrame = -Infinity;
  private closed = false;
  constructor(canvas: HTMLCanvasElement, private failed: () => void) {
    this.canvas = canvas; canvas.width = PROGRAM_WIDTH; canvas.height = PROGRAM_HEIGHT;
    this.frame = requestAnimationFrame(this.paint);
  }
  capture(): MediaStream { return this.stream ??= this.canvas.captureStream(PROGRAM_FPS); }
  take(source: ProgramSource, transition: StudioTransition, bridge?: ProgramSource, reducedMotion = false): Promise<void> {
    if (this.closed || this.next) { source.close(); bridge?.close(); return Promise.reject(new Error('Hay un cambio de escena en curso.')); }
    if (transition.effect === 'visual' && !bridge) { source.close(); return Promise.reject(new Error('Falta el contenido intermedio.')); }
    if (!this.current || transition.effect === 'cut') { bridge?.close(); this.current?.close(); this.current = source; return Promise.resolve(); }
    return new Promise((done, reject) => { this.next = { source, bridge, reducedMotion, start: performance.now(), transition, done, reject }; });
  }
  private paint = (time: number) => {
    if (this.closed) return;
    this.frame = requestAnimationFrame(this.paint);
    if (!this.current && !this.next) return;
    if (time - this.lastFrame < 1000 / PROGRAM_FPS) return;
    this.lastFrame = time;
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#0f1419'; ctx.fillRect(0, 0, PROGRAM_WIDTH, PROGRAM_HEIGHT);
    try {
      this.current?.draw(ctx, Date.now());
      const next = this.next;
      if (next) {
        const progress = Math.min(1, Math.max(0, (time - next.start) / next.transition.durationMs));
        ctx.save();
        try {
          if (next.transition.effect === 'visual' && next.bridge) {
            const elapsed = Math.max(0, time - next.start);
            const edge = next.reducedMotion ? 0 : Math.min(200, next.transition.durationMs / 4);
            ctx.globalAlpha = edge ? Math.min(1, elapsed / edge) : 1;
            next.bridge.draw(ctx, Date.now());
            if (progress === 1 || edge && elapsed >= next.transition.durationMs - edge) {
              ctx.globalAlpha = edge ? Math.min(1, (elapsed - next.transition.durationMs + edge) / edge) : 1;
              next.source.draw(ctx, Date.now());
            }
          } else {
            if (next.transition.effect === 'fade') ctx.globalAlpha = progress;
            else { ctx.beginPath(); ctx.rect(0, 0, PROGRAM_WIDTH * progress, PROGRAM_HEIGHT); ctx.clip(); }
            next.source.draw(ctx, Date.now());
          }
        } finally { ctx.restore(); }
        if (progress === 1) { this.current?.close(); next.bridge?.close(); this.current = next.source; this.next = null; next.done(); }
      }
    } catch {
      ctx.globalAlpha = 1;
      const failed = this.next; this.next = null;
      if (failed) { failed.source.close(); failed.bridge?.close(); failed.reject(new Error('No se pudo completar la transición. Se conserva la escena anterior.')); }
      this.failed();
    }
  };
  close(): void {
    this.closed = true; cancelAnimationFrame(this.frame);
    this.current?.close(); this.current = null;
    if (this.next) { this.next.source.close(); this.next.bridge?.close(); this.next.done(); this.next = null; }
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null;
  }
}

function lines(ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth: number, lineHeight: number, limit: number) {
  const words = text.split(/\s+/); let line = '', count = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { ctx.fillText(line, PROGRAM_WIDTH / 2, y); y += lineHeight; if (++count >= limit) return; line = word; }
    else line = next;
  }
  if (line && count < limit) ctx.fillText(line, PROGRAM_WIDTH / 2, y);
}
export function createTextProgramSource(scene: StudioPreparedScene, now?: number): ProgramSource {
  // La cuenta comienza al aparecer en programa, aunque la preparación tarde.
  let deadline = now === undefined ? undefined : scene.holding?.seconds ? now + scene.holding.seconds * 1000 : null;
  return { close() {}, draw(ctx, time) {
    if (deadline === undefined) deadline = scene.holding?.seconds ? time + scene.holding.seconds * 1000 : null;
    ctx.fillStyle = '#0f1419'; ctx.fillRect(0, 0, PROGRAM_WIDTH, PROGRAM_HEIGHT);
    ctx.fillStyle = '#00d4b3'; ctx.fillRect(80, 86, 72, 5);
    ctx.textAlign = 'left'; ctx.font = '600 21px system-ui'; ctx.fillText('SOFLIA  /  LEARNING', 80, 140);
    ctx.textAlign = 'center'; ctx.fillStyle = '#9aa4af'; ctx.font = '500 21px system-ui'; ctx.fillText(scene.name.toLocaleUpperCase(), PROGRAM_WIDTH / 2, 240);
    ctx.fillStyle = '#ffffff'; ctx.font = '600 48px system-ui'; lines(ctx, scene.title, 322, 1080, 58, 3);
    ctx.fillStyle = '#9aa4af'; ctx.font = '24px system-ui'; lines(ctx, scene.description, 505, 1000, 34, 2);
    const countdown = countdownText(deadline, time);
    if (countdown) { ctx.fillStyle = '#00d4b3'; ctx.font = '600 62px system-ui'; ctx.fillText(countdown, PROGRAM_WIDTH / 2, 640); }
  } };
}
export async function createMediaProgramSource(scene: StudioPreparedScene, stream?: MediaStream, signal?: AbortSignal): Promise<ProgramSource> {
  const element = stream || scene.kind === 'video' ? document.createElement('video') : document.createElement('img');
  const video = element instanceof HTMLVideoElement ? element : null;
  if (video) { video.muted = true; video.playsInline = true; video.loop = !stream; }
  else (element as HTMLImageElement).crossOrigin = 'anonymous';
  const close = () => { stream?.getTracks().forEach((track) => track.stop()); if (video) { video.pause(); video.srcObject = null; } element.removeAttribute('src'); };
  try {
    if (signal?.aborted) throw new Error('La preparación se canceló.');
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => finish(new Error('La fuente no respondió.')), 10000);
      const abort = () => finish(new Error('La preparación se canceló.'));
      const finish = (error?: Error) => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); element.onload = null; element.onerror = null; if (video) video.onloadeddata = null; if (error) reject(error); else resolve(); };
      signal?.addEventListener('abort', abort, { once: true });
      element.onerror = () => finish(new Error('No se pudo abrir el contenido.'));
      if (video) video.onloadeddata = () => finish(); else element.onload = () => finish();
      if (video && stream) video.srcObject = stream; else element.setAttribute('src', scene.assetUrl || '');
      if (video) void video.play().catch(() => finish(new Error('No se pudo reproducir el video.')));
    });
    const test = document.createElement('canvas'); test.width = test.height = 1;
    const context = test.getContext('2d'); context?.drawImage(element, 0, 0, 1, 1); context?.getImageData(0, 0, 1, 1);
    return { close, draw(ctx) {
      ctx.fillStyle = '#0f1419'; ctx.fillRect(0, 0, PROGRAM_WIDTH, PROGRAM_HEIGHT);
      if (stream?.getVideoTracks().some((track) => track.readyState === 'ended')) {
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = '28px system-ui'; ctx.fillText('La fuente ya no está disponible', PROGRAM_WIDTH / 2, PROGRAM_HEIGHT / 2); return;
      }
      const width = video ? video.videoWidth : (element as HTMLImageElement).naturalWidth;
      const height = video ? video.videoHeight : (element as HTMLImageElement).naturalHeight;
      if (!width || !height) return;
      const scale = Math.min(PROGRAM_WIDTH / width, PROGRAM_HEIGHT / height);
      ctx.drawImage(element, (PROGRAM_WIDTH - width * scale) / 2, (PROGRAM_HEIGHT - height * scale) / 2, width * scale, height * scale);
    } };
  } catch (error) { close(); throw error; }
}
