/** Música PCM determinista, sin recursos externos ni voz. */
export function synthesizeAudio(seconds: number, seed: number, silence: boolean): Buffer {
  const rate = 48000, samples = Math.round(seconds * rate), data = Buffer.alloc(44 + samples * 4);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(samples * 4, 40);
  if (silence) return data;
  let state = seed;
  const notes = [130.81, 164.81, 196, 261.63];
  for (let i = 0; i < samples; i++) {
    const t = i / rate, beat = t * 2, pulse = beat % 1, freq = notes[Math.floor(beat) % notes.length];
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = state / 4294967296 - .5;
    const envelope = Math.min(1, t * 3, (seconds - t) * 3);
    const bass = Math.sin(t * Math.PI * 2 * 65.405) * .14;
    const melody = Math.sin(t * Math.PI * 2 * freq + Math.sin(t * Math.PI * 2 * freq * 2) * .8) * Math.exp(-pulse * 4) * .2;
    const tick = noise * Math.exp(-pulse * 80) * .17;
    const value = Math.round((bass + melody + tick) * envelope * 32767);
    data.writeInt16LE(value, 44 + i * 4); data.writeInt16LE(value, 46 + i * 4);
  }
  return data;
}
