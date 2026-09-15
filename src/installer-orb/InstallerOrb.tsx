import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { OrbCanvas } from '../components/orb/OrbCanvas';
import { parseOrbState, type InstallerOrbState } from './orb-state';

interface LocalWebView {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

export class OrbBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p role="status" className="orb-error">No se pudo iniciar la orbe 3D. La instalación sigue disponible.</p>
      : this.props.children;
  }
}

export function InstallerOrb() {
  const [state, setState] = useState<InstallerOrbState>({ visualState: 'idle', motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  // Señales vacías: el instalador no pide ni usa micrófono, TTS o cuentas.
  const audio = { level: useRef(0), tone: useRef(0.4), bands: useRef(new Float32Array(8)) };
  useEffect(() => {
    const bridge = (window as Window & { chrome?: { webview?: LocalWebView } }).chrome?.webview;
    const receive = (event: MessageEvent<unknown>) => {
      const next = parseOrbState(event.data);
      if (next) setState(next);
    };
    bridge?.addEventListener('message', receive);
    return () => bridge?.removeEventListener('message', receive);
  }, []);
  return <OrbBoundary>
    <OrbCanvas visualState={state.visualState} audio={audio} motionEnabled={state.motion} />
    <p className="orb-hint">Arrastra para girar · Doble clic para centrar</p>
  </OrbBoundary>;
}
