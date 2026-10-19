import { createRoot } from 'react-dom/client';
import { StudioOutputReceiver } from '../../../src/components/learning-live/instructor/StudioOutputReceiver';
import { StudioProgramRenderer, createMediaProgramSource } from '../../../src/services/studio-program-renderer';
import { connectProgramOutput } from '../../../src/services/studio-output';

// Fixture exclusiva de QA; no abre cámara/micrófono, Learning ni cuentas reales.
if (new URLSearchParams(location.search).get('view') === 'studio-output') {
  createRoot(document.getElementById('root')!).render(<StudioOutputReceiver />);
  console.log('QA_RECEPTOR ' + JSON.stringify({ publisher: typeof window.studioOutput, general: typeof window.ipcRenderer, receiver: Object.keys(window.studioOutputReceiver || {}).sort() }));
} else {
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const program = new StudioProgramRenderer(canvas, () => { throw new Error('Composición fallida'); });
  const source = (color: string) => ({ close() {}, draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = color; ctx.fillRect(0, 0, 1280, 720); } });
  const smoke = { program, source, close: () => {}, start: async () => {
    await program.take(source('#ff0000'), { effect: 'cut', durationMs: 100 });
    const ready = new Promise<void>((resolve) => window.studioOutput!.onState((event) => { if (event.state === 'ready') resolve(); }));
    smoke.close = await connectProgramOutput(program.capture(), () => true); await ready;
    const frame = document.createElement('iframe'); frame.src = '/zoom-runtime/index.html'; document.body.append(frame);
  } };
  Object.assign(window, { smoke });
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let currentTrack = '', lastPixel: number[] = [];
  window.addEventListener('message', (event) => {
    if (event.source !== document.querySelector('iframe')?.contentWindow || event.origin !== location.origin) return;
    if (event.data?.error) console.error('QA_ERROR ' + event.data.error);
    if (event.data?.track) currentTrack = event.data.track;
    if (event.data?.pixel) lastPixel = event.data.pixel;
  });
  void (async () => {
    await smoke.start();
    const frame = document.querySelector('iframe')!;
    for (let i = 0; i < 100 && !currentTrack; i++) await delay(100);
    if (!currentTrack) throw new Error('No se pudo capturar la salida');
    const sample = async () => { lastPixel = []; frame.contentWindow!.postMessage({ type: 'sample' }, location.origin); for (let i = 0; i < 50 && !lastPixel.length; i++) await delay(100); return lastPixel; };
    await delay(600); const first = await sample(); const track = currentTrack;
    await program.take(source('#00ff00'), { effect: 'fade', durationMs: 500 }); await delay(800); const second = await sample();
    await program.take(source('#0000ff'), { effect: 'wipe', durationMs: 500 }); await delay(800); const third = await sample();
    const image = document.createElement('canvas'); image.width = 32; image.height = 18;
    const imageContext = image.getContext('2d')!; imageContext.fillStyle = '#ffff00'; imageContext.fillRect(0, 0, 32, 18);
    const bridge = await createMediaProgramSource({ id: 'imagen', name: 'Imagen intermedia', kind: 'image', title: '', description: '', assetUrl: image.toDataURL('image/png') });
    const change = program.take(source('#ff0000'), { effect: 'visual', durationMs: 4000, sceneId: 'imagen' }, bridge);
    await delay(1800); const visual = await sample(); await change; await delay(800); const fourth = await sample();
    console.log('QA_PROGRAMA ' + JSON.stringify({ first, second, third, visual, fourth, sameTrack: track === currentTrack }));
    smoke.close(); program.close();
  })().catch((error) => console.error('QA_ERROR ' + error.stack));
}
