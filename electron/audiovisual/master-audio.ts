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
  const fields = ['input_i', 'input_tp', 'input_lra'];
  if (fields.some(field => !Number.isFinite(Number(measured[field])))) throw new Error('La síntesis no contiene audio medible.');
  let gain = -14 - Number(measured.input_i), ceiling = -2.5;
  let levels = { lufs: NaN, pico: NaN, rangoDinamico: NaN };
  for (let attempt = 0; attempt < 3; attempt++) {
    // Ganancia fija conserva el crescendo; loudnorm dinámico lo aplanaba al
    // no poder alcanzar el objetivo con una normalización puramente lineal.
    const filter = `volume=${gain}dB,alimiter=limit=${10 ** (ceiling / 20)}:attack=2:release=80:level=false:latency=true`;
    await mediaProcess(ffmpeg, ['-v', 'error', '-y', '-i', source, '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '320k', target], signal);
    const result = await measureAudio(ffmpeg, target, signal);
    levels = { lufs: Number(result.input_i), pico: Number(result.input_tp), rangoDinamico: Number(result.input_lra) };
    if (Number.isFinite(levels.lufs) && Math.abs(levels.lufs + 14) <= 1 && Number.isFinite(levels.pico) && levels.pico <= -1) return levels;
    if (!Number.isFinite(levels.lufs) || !Number.isFinite(levels.pico)) break;
    gain += -14 - levels.lufs;
    if (levels.pico > -1) ceiling -= levels.pico + 1.5;
  }
  throw new Error(`El AAC no cumple la masterización: ${levels.lufs} LUFS, ${levels.pico} dBTP.`);
}
