import { mediaProcess } from './process';

const profile = 'I=-14:TP=-2.5:LRA=11';

export async function measureAudio(ffmpeg: string, file: string, signal: AbortSignal): Promise<Record<string, string>> {
  const output = await mediaProcess(ffmpeg, ['-hide_banner', '-i', file, '-vn', '-af', `loudnorm=${profile}:print_format=json`, '-f', 'null', '-'], signal, undefined, true);
  const json = output.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)?.pop();
  if (!json) throw new Error('No se pudo medir la sonoridad del audio.');
  return JSON.parse(json);
}

/** Mide el AAC antes del render costoso; el mux conserva exactamente esa pista. */
export async function masterAudio(ffmpeg: string, source: string, target: string, silence: boolean, signal: AbortSignal) {
  if (silence) {
    await mediaProcess(ffmpeg, ['-v', 'error', '-y', '-i', source, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '320k', target], signal);
    return null;
  }
  const measured = await measureAudio(ffmpeg, source, signal);
  const fields = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
  if (fields.some(field => !Number.isFinite(Number(measured[field])))) throw new Error('La síntesis no contiene audio medible.');
  let levels = { lufs: NaN, pico: NaN };
  for (const ceiling of [-2.5, -3.5]) {
    const filter = `loudnorm=I=-14:TP=${ceiling}:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
    await mediaProcess(ffmpeg, ['-v', 'error', '-y', '-i', source, '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '320k', target], signal);
    const result = await measureAudio(ffmpeg, target, signal);
    levels = { lufs: Number(result.input_i), pico: Number(result.input_tp) };
    if (Number.isFinite(levels.lufs) && Math.abs(levels.lufs + 14) <= 1 && Number.isFinite(levels.pico) && levels.pico <= -1) return levels;
  }
  throw new Error(`El AAC no cumple la masterización: ${levels.lufs} LUFS, ${levels.pico} dBTP.`);
}
