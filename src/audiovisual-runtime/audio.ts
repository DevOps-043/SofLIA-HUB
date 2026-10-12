import type { CinematicFilm } from '../shared/audiovisual/film-schema';
import { scoreEvents } from '../shared/audiovisual/audio-score';
const midi=(note:number)=>440*2**((note-69)/12);

/** Síntesis offline nativa: osciladores antialias, filtros, espacialización y reverberación. */
export async function renderAudio(film:CinematicFilm) {
  const rate=48000, samples=Math.round(film.fotogramas/film.fps*rate), seconds=samples/rate;
  const context=new OfflineAudioContext(2,samples,rate), events=scoreEvents(film);
  let seed=film.semilla;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  const noise=context.createBuffer(1,rate*3,rate), noiseData=noise.getChannelData(0);
  for(let i=0;i<noiseData.length;i++)noiseData[i]=random();
  const dry=context.createGain(), wet=context.createGain(), pads=context.createGain(), bass=context.createGain(), effects=context.createGain();
  dry.gain.value=.7;wet.gain.value=.17;effects.gain.value=film.sonido?.efectos??.8;
  const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=28;high.Q.value=.6;
  const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=15;compressor.ratio.value=2.3;compressor.attack.value=.009;compressor.release.value=.19;
  const master=context.createGain();master.gain.setValueAtTime(0,0);master.gain.linearRampToValueAtTime(1,.025);master.gain.setValueAtTime(1,Math.max(.026,seconds-.85));master.gain.linearRampToValueAtTime(0,seconds);
  dry.connect(high);wet.connect(high);high.connect(compressor);compressor.connect(master);master.connect(context.destination);
  const impulse=context.createBuffer(2,Math.round(rate*1.8),rate);
  for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);let filtered=0;for(let i=0;i<data.length;i++){const t=i/rate;filtered+=.16*(random()-filtered);data[i]=filtered*Math.exp(-t*3.8)*Math.min(1,t/.012);}}
  const reverb=context.createConvolver();reverb.buffer=impulse;reverb.normalize=true;reverb.connect(wet);
  const verbFilter=context.createBiquadFilter();verbFilter.type='highpass';verbFilter.frequency.value=230;verbFilter.connect(reverb);
  // Ecos discretos ligados al tempo; el bajo permanece fuera de la reverberación.
  const echo=context.createGain();echo.gain.value=.18;
  for(const [beats,pan,level] of [[.75,-.38,.8],[1.5,.38,.5]]) {
    const delay=context.createDelay(2), filter=context.createBiquadFilter(), spatial=context.createStereoPanner(), gain=context.createGain();
    delay.delayTime.value=beats*60/(film.sonido?.tempo??120);filter.type='lowpass';filter.frequency.value=2800;spatial.pan.value=pan;gain.gain.value=level;
    echo.connect(delay);delay.connect(filter);filter.connect(spatial);spatial.connect(gain);gain.connect(dry);
  }
  bass.connect(dry);
  pads.connect(dry);pads.connect(verbFilter);effects.connect(dry);effects.connect(verbFilter);
  const route=(node:AudioNode,gain:number,at:number,duration:number,pan:number,voice:string)=>{
    const level=context.createGain(), spatial=context.createStereoPanner();spatial.pan.value=pan;
    const attack=voice==='pad'?.35:voice==='sweep'?.2:voice==='lead'?.025:voice==='impact'?.015:.003, release=voice==='pad'?.6:.04;
    const end=Math.min(seconds,at+duration), peak=Math.min(end-.001,at+attack);
    level.gain.setValueAtTime(.00001,at);level.gain.exponentialRampToValueAtTime(Math.max(.00002,gain),Math.max(at+.0001,peak));
    if(voice==='pad'||voice==='bass'){level.gain.setValueAtTime(gain,Math.max(peak,end-release));level.gain.exponentialRampToValueAtTime(.00001,end);}
    else level.gain.exponentialRampToValueAtTime(.00001,end);
    node.connect(level);level.connect(spatial);
    const bus=voice==='bass'?bass:voice==='pad'?pads:['sweep','impact','ui'].includes(voice)?effects:dry;
    spatial.connect(bus);if(['pluck','lead'].includes(voice))spatial.connect(echo);if(bus===dry&&['pluck','lead','snare'].includes(voice))spatial.connect(verbFilter);
  };
  if(film.audio!=='silencio') for(const event of events) {
    const {voice,at,duration,gain,pan,notes}=event;
    if(['hat','snare','sweep'].includes(voice)) {
      const source=context.createBufferSource();source.buffer=noise;
      const filter=context.createBiquadFilter();filter.type=voice==='hat'?'highpass':'bandpass';filter.frequency.setValueAtTime(voice==='hat'?6500:voice==='snare'?1900:500,at);filter.Q.value=voice==='hat'?.7:.55;
      if(voice==='sweep')filter.frequency.exponentialRampToValueAtTime(4200,at+duration);
      source.connect(filter);route(filter,gain,at,duration,pan,voice);
      if(voice==='snare'){const body=context.createOscillator();body.type='sine';body.frequency.value=180;route(body,gain*.42,at,duration,pan,voice);body.start(at);body.stop(at+duration);}
      source.start(at,Math.max(0,(at*.618)%1));source.stop(at+duration);
    } else if(voice==='kick'||voice==='impact') {
      const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(voice==='kick'?150:105,at);oscillator.frequency.exponentialRampToValueAtTime(voice==='kick'?45:31,at+.16);route(oscillator,gain,at,duration,0,voice);oscillator.start(at);oscillator.stop(at+duration);
    } else for(let i=0;i<notes.length;i++) {
      const note=notes[i], frequency=midi(note), oscillator=context.createOscillator();
      oscillator.type=voice==='pad'?'sawtooth':voice==='bass'?'triangle':'sine';oscillator.frequency.value=frequency;
      oscillator.detune.value=voice==='pad'?(i%2?5:-5):0;
      const filter=context.createBiquadFilter();filter.type='lowpass';filter.Q.value=.7;filter.frequency.setValueAtTime(voice==='pad'?650:voice==='bass'?650:Math.min(4200,frequency*3),at);
      if(voice==='pad')filter.frequency.linearRampToValueAtTime(1700,at+duration*.8);
      oscillator.connect(filter);route(filter,gain/Math.sqrt(notes.length),at,duration,pan+(i%2?.12:-.12),voice);
      if(['pluck','lead','ui'].includes(voice)){const mod=context.createOscillator(), depth=context.createGain();mod.frequency.value=frequency*(voice==='lead'?2.01:3.01);depth.gain.setValueAtTime(frequency*(voice==='lead'?.22:voice==='ui'?.15:.5),at);depth.gain.exponentialRampToValueAtTime(.001,at+duration);mod.connect(depth);depth.connect(oscillator.frequency);mod.start(at);mod.stop(at+duration);}
      oscillator.start(at);oscillator.stop(at+duration);
    }
    if(voice==='kick')for(const [bus,depth] of [[pads,.8],[bass,.65]] as const){bus.gain.setValueAtTime(1,at);bus.gain.linearRampToValueAtTime(depth,at+.008);bus.gain.exponentialRampToValueAtTime(1,at+.16);}
  }
  const buffer=await context.startRendering(), left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  let peak=0,energy=0,difference=0;
  for(let i=0;i<samples;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2+right[i]**2;difference+=(left[i]-right[i])**2;}
  const normalization=peak>.8?.8/peak:1, bytes=new Uint8Array(44+samples*6), view=new DataView(bytes.buffer);
  const write=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
  write(0,'RIFF');view.setUint32(4,bytes.length-8,true);write(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*6,true);view.setUint16(32,6,true);view.setUint16(34,24,true);write(36,'data');view.setUint32(40,samples*6,true);
  for(let i=0;i<samples;i++)for(let c=0;c<2;c++){const value=Math.round((c?right[i]:left[i])*normalization*8388607);const offset=44+i*6+c*3;bytes[offset]=value&255;bytes[offset+1]=(value>>8)&255;bytes[offset+2]=(value>>16)&255;}
  let binary='';for(let offset=0;offset<bytes.length;offset+=16384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16384));
  return {base64:btoa(binary),report:{motor:'Web Audio offline',muestras:samples,bits:24,frecuencia:rate,canales:2,eventos:film.audio==='silencio'?0:events.length,pico:peak*normalization,rms:Math.sqrt(energy/(samples*2))*normalization,anchoEstereo:Math.sqrt(difference/Math.max(energy,.000001)),normalizacion:normalization}};
}
