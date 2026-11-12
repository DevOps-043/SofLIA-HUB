import { AvatarViewer, type Metrics } from '../integration/web/viewer';
import { states, type AvatarState, type Quality } from '../integration/web/controller';
import './style.css';

const assets = import.meta.glob<string>(['../assets/**/*.glb', '../assets/**/*.svg', '../previews/*.png'], { eager: true, query: '?url', import: 'default' });
const asset = (path: string): string => {
  const url = assets[`../${path}`];
  if (!url) throw new Error(`Falta el recurso ${path}`);
  return url;
};
const labels: Record<AvatarState, string> = { idle: 'En espera', listening: 'Escuchando', thinking: 'Pensando', speaking: 'Respondiendo', success: 'Éxito', warning: 'Advertencia' };
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><div class="brand"><img src="${asset('assets/logos/soflia-original.svg')}" alt="">Sof<span>LIA</span></div><div class="badge">Estudio de movimiento</div></header>
<main><div class="intro"><div><div class="eyebrow">Arquitecta · Humanista · Pragmática</div><h1>Inteligencia con presencia.</h1></div><p>Un agente que escucha, comprende y acompaña.<br>Explora sus expresiones y encuentra el ritmo de cada interacción.</p></div>
<div class="workspace"><section class="stage-shell" aria-label="Vista previa"><div class="stage-top"><i class="status-dot"></i><span id="current-state">Preparando el agente…</span></div><div id="stage" class="stage"></div><div class="stage-hint">Arrastra para explorar · Rueda para acercar</div><div class="view-tools"><button class="quiet" id="background">Fondo claro</button><button class="quiet" id="reset">Reiniciar</button></div></section>
<aside class="panel"><h2>Controles del agente</h2>
<div class="control"><label for="speed">Velocidad <output id="speed-value">1.0×</output></label><input id="speed" type="range" min="0.1" max="2" step=".1" value="1"></div>
<div class="control"><label for="light">Iluminación <output id="light-value">1.0</output></label><input id="light" type="range" min=".1" max="3" step=".1" value="1"></div>
<div class="control"><label for="audio">Nivel de audio <output id="audio-value">0%</output></label><input id="audio" type="range" min="0" max="1" step=".01" value="0"></div>
<div class="control"><label for="quality">Calidad gráfica</label><select id="quality"><option value="low">Baja · 30 FPS objetivo</option><option value="medium" selected>Media · Equilibrada</option><option value="high">Alta · Escritorio</option></select></div>
<div class="divider"></div><div class="gesture-grid"><button class="quiet" data-gesture="lookLeft">Mirar izquierda</button><button class="quiet" data-gesture="lookRight">Mirar derecha</button><button class="quiet" data-gesture="lookUp">Mirar arriba</button><button class="quiet" data-gesture="lookDown">Mirar abajo</button><button class="quiet" data-gesture="blink">Parpadear</button><button class="quiet" data-gesture="nod">Asentir</button></div></aside></div>
<section class="states" aria-label="Estados de animación">${states.map((state, index) => `<button class="state" data-state="${state}" aria-pressed="${state === 'idle'}"><img src="${asset(`previews/state_${state}.png`)}" alt=""><span>${labels[state]}</span><small>0${index + 1}</small></button>`).join('')}</section>
<div id="metrics" class="metrics" aria-live="off"></div><p id="error" class="error" role="status"></p><footer class="foot"><span>SofLIA · Agente visual tridimensional</span><span>Movimientos discretos. Intención clara.</span></footer></main>`;

let latest: Metrics | null = null;
const viewer = new AvatarViewer(document.querySelector('#stage')!, {
  modelUrl: asset('assets/glb/soflia_agent.glb'), fallbackUrl: asset('previews/avatar_front.png'),
  onMetrics: metrics => {
    latest = metrics;
    document.querySelector('#metrics')!.innerHTML = `<span><b>${metrics.fps.toFixed(0)}</b> FPS</span><span><b>${metrics.frameMs.toFixed(1)}</b> ms de render</span><span><b>${metrics.drawCalls}</b> llamadas de dibujo</span><span><b>${metrics.triangles.toLocaleString('es')}</b> triángulos</span><span><b>${(metrics.loadMs / 1000).toFixed(2)}</b> s de carga</span>`;
    document.querySelector('#current-state')!.textContent = labels[viewer.controller!.state];
  }, onError: message => { document.querySelector('#error')!.textContent = `Vista estática disponible. ${message}`; },
});
await viewer.ready;
if (viewer.controller) document.querySelector('#current-state')!.textContent = labels.idle;
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-state]')) button.addEventListener('click', () => {
  const state = button.dataset.state as AvatarState; viewer.controller?.setState(state); viewer.invalidate();
  for (const item of document.querySelectorAll('[data-state]')) item.setAttribute('aria-pressed', String(item === button));
  document.querySelector('#current-state')!.textContent = labels[state];
});
for (const id of ['speed', 'light', 'audio']) document.querySelector<HTMLInputElement>(`#${id}`)!.addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value);
  if (id === 'speed') viewer.controller?.setSpeed(value);
  if (id === 'light') viewer.controller?.setLightIntensity(value);
  if (id === 'audio') viewer.controller?.setAudioLevel(value);
  document.querySelector(`#${id}-value`)!.textContent = id === 'audio' ? `${Math.round(value * 100)}%` : `${value.toFixed(1)}${id === 'speed' ? '×' : ''}`;
  viewer.invalidate();
});
document.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', event => viewer.setQuality((event.target as HTMLSelectElement).value as Quality));
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-gesture]')) button.addEventListener('click', () => {
  const gesture = button.dataset.gesture as 'lookLeft' | 'lookRight' | 'lookUp' | 'lookDown' | 'blink' | 'nod'; viewer.controller?.[gesture](); viewer.invalidate();
});
let light = false;
document.querySelector('#background')!.addEventListener('click', () => { light = !light; document.body.classList.toggle('light', light); viewer.setBackground(light); document.querySelector('#background')!.textContent = light ? 'Fondo oscuro' : 'Fondo claro'; });
document.querySelector('#reset')!.addEventListener('click', () => { viewer.controller?.resetPose(); viewer.resetCamera(); });
window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
// Acceso local para pruebas reproducibles del visor; no expone herramientas de desarrollo al runtime.
Object.assign(window, { sofliaDemo: { viewer, metrics: () => latest } });
