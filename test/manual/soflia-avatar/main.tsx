import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SofliaAvatar, type SofliaAvatarHandle } from '../../../src/components/avatar/SofliaAvatar';
import { AVATAR_EXPRESSIONS, EXPRESSION_LABELS, type AvatarExpression } from '../../../src/components/avatar/avatar-model';
import { useAudioFeatures, type AudioFeatureSource } from '../../../src/components/orb/useAudioFeatures';
import '../../../src/styles/theme-light.css';
import './preview.css';

export function Preview() {
  const initial = new URLSearchParams(location.search).get('expression');
  const [expression, setExpression] = useState<AvatarExpression>(AVATAR_EXPRESSIONS.includes(initial as AvatarExpression) ? initial as AvatarExpression : 'idle');
  const [theme, setTheme] = useState('dark');
  const [size, setSize] = useState(440);
  const [motion, setMotion] = useState(true);
  const [level, setLevel] = useState(0);
  const [tone, setTone] = useState(.4);
  const [micRequested, setMicRequested] = useState(false);
  const [fileSource, setFileSource] = useState<AudioFeatureSource>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState('');
  const avatar = useRef<SofliaAvatarHandle>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const levelRef = useRef(0);
  const toneRef = useRef(.4);
  const manualBands = useRef(new Float32Array(8));
  const manualFeatures = useMemo(() => ({ tone: toneRef, bands: manualBands }), []);
  const featureSource = useMemo<AudioFeatureSource>(() => micRequested ? { kind: 'mic' } : fileSource, [micRequested, fileSource]);
  const measured = useAudioFeatures(featureSource, setAudioError);
  const audioGraph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode } | null>(null);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => {
    toneRef.current = tone;
    for (let band = 0; band < 8; band++) manualBands.current[band] = level * Math.exp(-((band / 7 - tone) ** 2) / .07);
  }, [tone, level]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => { audioGraph.current?.source.disconnect(); void audioGraph.current?.context.close(); }, []);
  const attachAudio = async () => {
    if (!audio.current) return;
    try {
      if (!audioGraph.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio.current);
        source.connect(context.destination);
        audioGraph.current = { context, source };
      }
      await audioGraph.current.context.resume();
      setFileSource({ kind: 'node', context: audioGraph.current.context, node: audioGraph.current.source });
      setAudioError('');
    } catch { setAudioError('No se pudo analizar el archivo de audio. Puedes seguir usando el control manual.'); }
  };
  const selectManual = () => { audio.current?.pause(); setMicRequested(false); setFileSource(null); setAudioUrl(null); };
  const showAvatar = () => {
    if (window.innerWidth <= 740) document.querySelector('.preview-stage')?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <main data-theme={theme}>
    <header><div className="brand">Sof<span>LIA</span><small>ARQUITECTA · HUMANISTA · PRAGMÁTICA</small></div><span className="preview-label">Avatar interactivo</span></header>
    <section className="preview-layout">
      <div className="preview-stage" data-testid="preview-stage">
        <div className="preview-orbit" />
        <div className="preview-avatar" style={{ width: size, height: size, maxWidth: '100%' }}>
          <SofliaAvatar ref={avatar} state={expression} audioLevel={featureSource ? measured.level : levelRef} audioFeatures={featureSource ? measured : manualFeatures} motionEnabled={motion} />
        </div>
        <div className="preview-status"><span />{EXPRESSION_LABELS[expression]}</div>
        {micRequested && <button type="button" className="preview-stop-mic" onClick={() => { setMicRequested(false); setAudioError(''); }}>Detener micrófono</button>}
        {audioError && <p role="alert" className="preview-source-error">{audioError}</p>}
        <p>Mueve el cursor. SofLIA te acompaña con la mirada.</p>
      </div>
      <aside><p className="eyebrow">PERSONALIDAD EN MOVIMIENTO</p><h1>La misma SofLIA.<br />Más expresiva.</h1><p className="description">El personaje original, con mirada atenta, gestos discretos y respuesta a la voz.</p>
        <div className="expression-grid">{AVATAR_EXPRESSIONS.map(value => <button key={value} type="button" aria-pressed={value === expression} onClick={() => { setExpression(value); showAvatar(); }}>{EXPRESSION_LABELS[value]}</button>)}</div>
        <div className="gesture-actions"><button onClick={() => avatar.current?.blink()}>Parpadear</button><button onClick={() => avatar.current?.nod()}>Asentir</button><button onClick={() => { avatar.current?.reset(); selectManual(); setExpression('idle'); setLevel(0); setTone(.4); }}>Restablecer</button></div>
        <div className="preview-settings">
          <label>Amplitud de demostración <output>{Math.round(level * 100)}%</output><input aria-label="Amplitud de demostración" type="range" min="0" max="1" step=".01" value={level} onChange={event => { selectManual(); setLevel(Number(event.target.value)); }} /></label>
          <label>Registro de demostración <output>{tone < .4 ? 'Grave' : tone > .65 ? 'Agudo' : 'Medio'}</output><input aria-label="Registro de demostración" type="range" min="0" max="1" step=".01" value={tone} onChange={event => { selectManual(); setTone(Number(event.target.value)); }} /></label>
          <p className="help">Controles manuales de demostración. La señal real usa el mismo analizador que el modo voz.</p>
          <button type="button" className="microphone-test" onClick={() => { audio.current?.pause(); setAudioUrl(null); setFileSource(null); setMicRequested(!micRequested); setExpression('listening'); showAvatar(); }}>{micRequested ? 'Detener prueba de micrófono' : 'Probar mi voz con micrófono'}</button>
          <label className="audio-file">Probar con audio real<input type="file" accept="audio/*" onChange={event => { const file = event.target.files?.[0]; if (file) { setMicRequested(false); setFileSource(null); setAudioUrl(URL.createObjectURL(file)); setExpression('speaking'); } }} /></label>
          <audio ref={audio} src={audioUrl ?? undefined} controls={Boolean(audioUrl)} onPlay={() => { void attachAudio(); showAvatar(); }} onPause={() => { setFileSource(null); }} />
          <label>Tamaño <output>{size}px</output><input aria-label="Tamaño" type="range" min="112" max="560" step="1" value={size} onChange={event => setSize(Number(event.target.value))} /></label>
          <div className="preview-options"><label><input type="checkbox" checked={motion} onChange={event => setMotion(event.target.checked)} /> Animación</label><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Fondo {theme === 'dark' ? 'claro' : 'oscuro'}</button></div>
        </div>
      </aside>
    </section><footer>Composición 2D · Imagen original aprobada · Sin WebGL</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
