import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { AvatarViewer } from '../web/viewer';
import type { AvatarController, AvatarState, Quality } from '../web/controller';

export interface SofliaAvatarHandle {
  setState(state: AvatarState): void;
  setAudioLevel(level: number): void;
  blink(): void;
  lookLeft(): void;
  lookRight(): void;
  lookUp(): void;
  lookDown(): void;
  nod(): void;
  tilt(horizontal?: number, vertical?: number): void;
  setExpression(expression: Parameters<AvatarController['setExpression']>[0]): void;
  resetPose(): void;
}
interface Props { modelUrl: string; fallbackUrl: string; state?: AvatarState; audioLevel?: number; quality?: Quality; className?: string; onError?: (message: string) => void; }

/** Adaptador renderer sin Node, IPC ni acoplamiento al proveedor de IA. */
export const SofliaAvatar = forwardRef<SofliaAvatarHandle, Props>(function SofliaAvatar({ modelUrl, fallbackUrl, state = 'idle', audioLevel = 0, quality = 'medium', className, onError }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<AvatarViewer | null>(null);
  const pending = useRef<((controller: AvatarController) => void)[]>([]);
  const latest = useRef({ state, audioLevel, quality, onError }); latest.current = { state, audioLevel, quality, onError };
  const apply = (run: (controller: AvatarController) => void): void => {
    if (viewer.current?.controller) { run(viewer.current.controller); viewer.current.invalidate(); }
    else pending.current = [...pending.current.slice(-15), run];
  };
  useImperativeHandle(ref, () => ({
    setState: value => apply(c => c.setState(value)), setAudioLevel: value => apply(c => c.setAudioLevel(value)),
    blink: () => apply(c => c.blink()), lookLeft: () => apply(c => c.lookLeft()), lookRight: () => apply(c => c.lookRight()),
    lookUp: () => apply(c => c.lookUp()), lookDown: () => apply(c => c.lookDown()), nod: () => apply(c => c.nod()),
    tilt: (x, y) => apply(c => c.tilt(x, y)), setExpression: value => apply(c => c.setExpression(value)), resetPose: () => apply(c => c.resetPose()),
  }), []);
  useEffect(() => {
    if (!host.current) return;
    const instance = new AvatarViewer(host.current, { modelUrl, fallbackUrl, quality: latest.current.quality, onError: message => latest.current.onError?.(message) });
    viewer.current = instance;
    void instance.ready.then(() => {
      if (viewer.current !== instance) return;
      instance.controller?.setState(latest.current.state); instance.controller?.setAudioLevel(latest.current.audioLevel); instance.setQuality(latest.current.quality); instance.invalidate();
      if (instance.controller) { pending.current.forEach(run => run(instance.controller!)); pending.current = []; instance.invalidate(); }
    });
    return () => { viewer.current = null; instance.dispose(); };
  }, [modelUrl, fallbackUrl]);
  useEffect(() => { viewer.current?.controller?.setState(state); viewer.current?.invalidate(); }, [state]);
  useEffect(() => { viewer.current?.controller?.setAudioLevel(audioLevel); viewer.current?.invalidate(); }, [audioLevel]);
  useEffect(() => { viewer.current?.setQuality(quality); }, [quality]);
  return <div ref={host} className={className} role="img" aria-label={`Agente SofLIA: ${state}`} style={{ width: '100%', height: '100%', minHeight: 120, position: 'relative' }} />;
});
