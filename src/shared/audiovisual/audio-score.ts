import type { CinematicFilm } from './film-schema';
export type ScoreVoice = 'pad'|'bass'|'pluck'|'lead'|'kick'|'snare'|'hat'|'sweep'|'impact'|'ui';
export type ScoreEvent = { at:number; duration:number; voice:ScoreVoice; notes:number[]; gain:number; pan:number };
export function scoreEvents(film: CinematicFilm): ScoreEvent[] {
  const seconds=film.fotogramas/film.fps, beat=60/(film.sonido?.tempo??120), events:ScoreEvent[]=[];
  const close=film.escenas[film.escenas.length-1], resolve=(close.inicio+close.transicion)/film.fps;
  const activation=film.escenas[1].inicio/film.fps;
  const development=(film.escenas.find(scene=>scene.elementos.some(el=>film.entidades.find(e=>e.id===el.id)?.tipo==='chat'))?.inicio??Math.round(film.fotogramas*.27))/film.fps;
  const growth=(film.escenas.find(scene=>scene.elementos.some(el=>film.entidades.find(e=>e.id===el.id)?.tipo==='leccion'))?.inicio??Math.round(film.fotogramas*.64))/film.fps;
  const strength=film.sonido?.intensidad??.8;
  const add=(voice:ScoreVoice,at:number,duration:number,notes:number[],gain:number,pan=0)=>{if(at>=0&&at<seconds)events.push({voice,at,duration:Math.min(duration,seconds-at),notes,gain:gain*strength,pan});};
  const chords=[[50,53,57,64],[46,50,53,57],[53,57,60,67],[48,52,55,62]], roots=[38,34,41,36], motif=[69,72,74,77,76,74,72,69];
  for(let at=0;at<resolve;at+=beat*8) {
    const i=Math.floor(at/(beat*8))%4, end=Math.min(resolve,at+beat*8);
    add('pad',at,end-at+.7,chords[i],at<activation?.12:.17,0);
  }
  for(let at=0;at<resolve;at+=beat/2) {
    const part=Math.floor(at/(beat*8))%4, phase=Math.min(1,at/Math.max(1,growth)), n=Math.round(at/(beat/2));
    if(at>=activation) add('pluck',at,beat*.8,[chords[part][n%4]+12],.09+phase*.07,Math.sin(n*1.7)*.5);
    if(at>=development) {
      add('bass',at,beat*.43,[roots[part]+(n%4===3?12:0)],.18);
      add('hat',at,.12,[],n%2?.027:.037,n%2?.45:-.4);
    }
    if(at>=growth&&n%2===0) add('lead',at,beat*2,[motif[n%motif.length]+(at>seconds*.8?12:0)],.062,Math.sin(n*.7)*.4);
  }
  for(let at=development;at<resolve-beat;at+=beat) {
    const n=Math.round((at-development)/beat);
    add('kick',at,.4,[38],.36);
    if(n%2===1) add('snare',at,.18,[],.083,.08);
  }
  for(const scene of film.escenas.slice(1,-1)) {
    const at=scene.inicio/film.fps;add('sweep',Math.max(0,at-.5),.9,[],.06,-.35);add('impact',at,1.4,[38],.16);
  }
  for(const scene of film.escenas) for(const action of scene.acciones) {
    const at=(scene.inicio+action.en)/film.fps;
    if(action.accion==='cierre') continue;
    add(action.accion==='transferencia'?'sweep':'ui',at,action.accion==='transferencia'?.7:.17,[action.accion==='confirmacion'?86:81],action.accion==='transferencia'?.075:.037,Math.sin(action.en)*.3);
  }
  add('sweep',Math.max(0,resolve-.75),.75,[],.14,0);
  add('impact',resolve,2.7,[38],.3);
  add('pad',resolve,seconds-resolve,[50,54,57,64],.23);
  add('lead',resolve,seconds-resolve,[74,81],.09,-.15);
  return events.sort((a,b)=>a.at-b.at);
}
