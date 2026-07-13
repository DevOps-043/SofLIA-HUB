import { Canvas } from '@react-three/fiber';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbMesh } from './OrbMesh';
import type { AudioFeatureRefs } from './useAudioFeatures';
import type { OrbPointerInteraction, OrbVisualState } from './orb-types';

// Canvas transparente para la ventana orbe. El rango de DPR evita gastar GPU
// en una ventana compacta; el diseño consigue contraste por capas, no por HDR
// saturado ni postprocesado.
export function OrbCanvas({ visualState, audio }: { visualState: OrbVisualState; audio: AudioFeatureRefs }) {
  const rotation = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0, time: 0 });
  const interaction: OrbPointerInteraction = { rotation, velocity, hovered, dragging };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const now = performance.now();
    const elapsed = Math.max(8, now - lastPointer.current.time);
    const deltaX = event.clientX - lastPointer.current.x;
    const deltaY = event.clientY - lastPointer.current.y;
    rotation.current.y += deltaX * 0.009;
    rotation.current.x = THREE.MathUtils.clamp(rotation.current.x + deltaY * 0.009, -1.35, 1.35);
    velocity.current.y = THREE.MathUtils.clamp((deltaX * 0.009) / (elapsed / 1000), -5, 5);
    velocity.current.x = THREE.MathUtils.clamp((deltaY * 0.009) / (elapsed / 1000), -5, 5);
    lastPointer.current = { x: event.clientX, y: event.clientY, time: now };
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    hovered.current = false;
    if (!dragging.current) event.currentTarget.style.cursor = 'grab';
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    velocity.current = { x: 0, y: 0 };
    lastPointer.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = 'grabbing';
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.style.cursor = hovered.current ? 'grab' : 'default';
  };

  return (
    <div
      className="h-full w-full touch-none"
      data-testid="orb-interaction-surface"
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => { hovered.current = true; event.currentTarget.style.cursor = 'grab'; }}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          depth: true,
          stencil: false,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, 4.1], fov: 42, near: 0.1, far: 30 }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
        performance={{ min: 0.65 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <OrbMesh visualState={visualState} audio={audio} interaction={interaction} />
      </Canvas>
    </div>
  );
}
