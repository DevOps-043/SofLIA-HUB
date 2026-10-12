import type { CinematicFilm } from '../shared/audiovisual/film-schema';
import { scoreEvents, type ScoreVoice } from '../shared/audiovisual/audio-score';
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Síntesis offline propia: piano amortiguado y armonías cálidas, sin muestras externas. */
export async function renderAudio(film: CinematicFilm) {
  const rate = 48000, samples = Math.round(film.fotogramas / film.fps * rate), seconds = samples / rate;
  const context = new OfflineAudioContext(2, samples, rate), events = scoreEvents(film);
  let seed = film.semilla;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  const noise = context.createBuffer(1, rate * 3, rate), noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = random();
  const dry = context.createGain(), wet = context.createGain(), effects = context.createGain();
  dry.gain.value = .7; wet.gain.value = .22; effects.gain.value = film.sonido?.efectos ?? .8;
  const high = context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 30; high.Q.value = .6;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 1.8; compressor.attack.value = .025; compressor.release.value = .3;
  const master = context.createGain();
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(1, .2);
  master.gain.setValueAtTime(1, seconds - 1); master.gain.linearRampToValueAtTime(0, seconds);
  dry.connect(high); wet.connect(high); high.connect(compressor); compressor.connect(master); master.connect(context.destination);
  const impulse = context.createBuffer(2, Math.round(rate * 2.4), rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel); let filtered = 0;
    for (let i = 0; i < data.length; i++) { const t = i / rate; filtered += .09 * (random() - filtered); data[i] = filtered * Math.exp(-t * 2.8) * Math.min(1, t / .025); }
  }
  const reverb = context.createConvolver(); reverb.buffer = impulse; reverb.normalize = true; reverb.connect(wet);
  const verbFilter = context.createBiquadFilter(); verbFilter.type = 'highpass'; verbFilter.frequency.value = 260; verbFilter.connect(reverb);
  effects.connect(dry); effects.connect(verbFilter);
  const route = (node: AudioNode, gain: number, at: number, duration: number, pan: number, voice: ScoreVoice) => {
    const level = context.createGain(), spatial = context.createStereoPanner(); spatial.pan.value = pan;
    const attack = voice === 'pad' ? .7 : voice === 'bass' ? .14 : voice === 'sweep' ? .2 : .012;
    const end = Math.min(seconds, at + duration), peak = at + Math.min(attack, duration * .25);
    level.gain.setValueAtTime(.00001, at); level.gain.exponentialRampToValueAtTime(Math.max(.00002, gain), peak);
    if (voice === 'pad' || voice === 'bass') level.gain.setValueAtTime(gain, Math.max(peak, end - Math.min(.65, duration * .4)));
    level.gain.exponentialRampToValueAtTime(.00001, end);
    node.connect(level); level.connect(spatial);
    spatial.connect(['sweep','impact','ui'].includes(voice) ? effects : dry);
    if (voice === 'piano' || voice === 'pad') spatial.connect(verbFilter);
  };
  if (film.audio !== 'silencio') for (const event of events) {
    const { voice, at, duration, gain, pan, notes } = event;
    if (voice === 'sweep') {
      const source = context.createBufferSource(); source.buffer = noise;
      const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = .45;
      filter.frequency.setValueAtTime(350, at); filter.frequency.exponentialRampToValueAtTime(1500, at + duration);
      source.connect(filter); route(filter, gain, at, duration, pan, voice);
      source.start(at, (at * .618) % 1); source.stop(at + duration);
    } else if (voice === 'kick' || voice === 'impact') {
      const oscillator = context.createOscillator(); oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(voice === 'kick' ? 65 : 55, at);
      oscillator.frequency.exponentialRampToValueAtTime(voice === 'kick' ? 42 : 35, at + Math.min(.2, duration));
      route(oscillator, gain, at, duration, 0, voice); oscillator.start(at); oscillator.stop(at + duration);
    } else for (let i = 0; i < notes.length; i++) {
      const frequency = midi(notes[i]), noteGain = gain / Math.sqrt(notes.length), notePan = pan + (i % 2 ? .12 : -.12);
      if (voice === 'piano') {
        // Parciales con afinación y decaimiento distintos: ataque redondeado, sin FM.
        for (const [partial, amplitude, decay] of [[1,1,1], [2,.26,.65], [3,.085,.4], [4,.025,.24]]) {
          const oscillator = context.createOscillator(); oscillator.type = 'sine';
          oscillator.frequency.value = frequency * partial * Math.sqrt(1 + .00012 * partial * partial);
          route(oscillator, noteGain * amplitude, at, Math.min(duration, .3 + duration * decay), notePan, voice);
          oscillator.start(at); oscillator.stop(at + duration);
        }
      } else {
        const oscillator = context.createOscillator(), filter = context.createBiquadFilter();
        oscillator.type = voice === 'pad' ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
        oscillator.detune.value = voice === 'pad' ? (i % 2 ? 3 : -3) : 0;
        filter.type = 'lowpass'; filter.Q.value = .5; filter.frequency.value = voice === 'pad' ? 850 : voice === 'bass' ? 350 : 1200;
        oscillator.connect(filter); route(filter, noteGain, at, duration, notePan, voice);
        oscillator.start(at); oscillator.stop(at + duration);
      }
    }
  }
  const buffer = await context.startRendering(), left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  let peak = 0, energy = 0, difference = 0;
  for (let i = 0; i < samples; i++) { peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); energy += left[i] ** 2 + right[i] ** 2; difference += (left[i] - right[i]) ** 2; }
  const normalization = peak > .8 ? .8 / peak : 1, bytes = new Uint8Array(44 + samples * 6), view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
  write(0,'RIFF'); view.setUint32(4,bytes.length-8,true); write(8,'WAVEfmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,2,true); view.setUint32(24,rate,true); view.setUint32(28,rate*6,true); view.setUint16(32,6,true); view.setUint16(34,24,true); write(36,'data'); view.setUint32(40,samples*6,true);
  for (let i = 0; i < samples; i++) for (let c = 0; c < 2; c++) { const value = Math.round((c ? right[i] : left[i]) * normalization * 8388607), offset = 44 + i * 6 + c * 3; bytes[offset] = value & 255; bytes[offset+1] = (value >> 8) & 255; bytes[offset+2] = (value >> 16) & 255; }
  let binary = ''; for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return { base64: btoa(binary), report: { motor: 'Web Audio offline', muestras: samples, bits: 24, frecuencia: rate, canales: 2, eventos: film.audio === 'silencio' ? 0 : events.length, pico: peak * normalization, rms: Math.sqrt(energy / (samples * 2)) * normalization, anchoEstereo: Math.sqrt(difference / Math.max(energy, .000001)), normalizacion: normalization } };
}
