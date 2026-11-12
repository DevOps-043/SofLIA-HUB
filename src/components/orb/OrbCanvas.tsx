import { useRef } from 'react';
import { SofliaAvatar, type SofliaAvatarHandle } from '../avatar/SofliaAvatar';
import type { AvatarExpression } from '../avatar/avatar-model';
import type { AudioFeatureRefs } from './useAudioFeatures';
import type { OrbVisualState } from './orb-types';

/** Fachada compartida de voz, asistencia e instalador; conserva el contrato previo. */
export function OrbCanvas({ visualState, audio, motionEnabled = true, expression }: {
  visualState: OrbVisualState; audio: AudioFeatureRefs; motionEnabled?: boolean; expression?: AvatarExpression;
}) {
  const avatar = useRef<SofliaAvatarHandle>(null);
  return <div className="h-full w-full" data-testid="orb-interaction-surface" tabIndex={0} role="group"
    aria-label="Avatar interactivo de SofLIA. Sigue el cursor. Flechas para dirigir la mirada; Inicio, Enter o doble clic para restablecer."
    onDoubleClick={() => avatar.current?.reset()}
    onKeyDown={event => {
      const targets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); avatar.current?.reset(); }
      else if (targets[event.key]) { event.preventDefault(); avatar.current?.setGazeTarget(...targets[event.key]); }
    }}>
    <SofliaAvatar ref={avatar} state={expression ?? visualState} expression={expression} audioLevel={audio.level} audioFeatures={audio} motionEnabled={motionEnabled} />
  </div>;
}
