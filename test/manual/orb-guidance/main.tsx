import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OrbCanvas } from '../../../src/components/orb/OrbCanvas';
import { OrbGuidanceControls } from '../../../src/components/orb/OrbGuidanceControls';
import { StudioGuidedPractice } from '../../../src/components/learning-live/instructor/StudioGuidedPractice';
import { initialGuidanceState, type GuidanceState } from '../../../src/shared/orb-guidance';
import '../../../src/index.css';
import '../../../src/components/learning-live/instructor/studio-panels.css';
import '../../../src/components/learning-live/instructor/studio-controls.css';

// Fixture explícita: ninguna receta llega a un agente ni a una sesión real.
window.orbGuidance = {
  getState: async () => ({ success: true, state: initialGuidanceState() }),
  showTarget: async () => ({ success: true }), control: async () => ({ success: true }),
  startPractice: async () => ({ success: true }), checkPractice: async () => ({ success: true }), onState: () => () => {},
};
const audio = { level: { current: 0 }, tone: { current: 0.4 }, bands: { current: new Float32Array(8) } };

export function Preview() {
  const native = new URLSearchParams(window.location.search).get('native') === 'orb';
  const [dark, setDark] = useState(true);
  const [state, setState] = useState<GuidanceState>({ ...initialGuidanceState(), phase: 'practice', instruction: 'Selecciona Insertar para abrir las herramientas de tablas.', practice: { title: 'Práctica de tablas', step: 1, total: 3 }, message: 'Abre la aplicación y sigue la indicación de SofLIA.' });
  document.documentElement.classList.toggle('dark', dark);
  return <main style={{ padding: native ? 0 : 24, color: 'var(--color-text-main)', background: native ? 'transparent' : 'var(--color-background-val)', minHeight: '100vh' }}>
    {!native && <><p>QA aislada · contenido de ejemplo</p><button onClick={() => setDark(!dark)}>{dark ? 'Modo claro' : 'Modo oscuro'}</button></>}
    <div data-testid="compact-orb" style={{ width: 208, height: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box' }}>
      <div style={{ width: 112, height: 112, flexShrink: 0, pointerEvents: 'none' }}><OrbCanvas visualState={state.phase === 'paused' ? 'idle' : 'acting'} audio={audio} motionEnabled={false} /></div>
      <OrbGuidanceControls state={state} error={null} control={async control => {
        if (control.action === 'pause') setState(previous => ({ ...previous, phase: 'paused' }));
        if (control.action === 'resume') setState(previous => ({ ...previous, phase: 'practice' }));
        if (control.action === 'stop') setState(previous => ({ ...previous, phase: 'complete' }));
        if (control.action === 'style') setState(previous => ({ ...previous, style: control.style }));
      }} check={async () => setState(previous => ({ ...previous, phase: 'complete', instruction: 'Práctica completada', message: 'Resultado de ejemplo comprobado.' }))} />
    </div>
    {!native && <section style={{ width: 'min(480px,100%)' }}><StudioGuidedPractice /></section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
