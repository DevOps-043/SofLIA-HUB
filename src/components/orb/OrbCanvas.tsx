import { Canvas } from '@react-three/fiber';
import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbMesh } from './OrbMesh';
import type { AudioFeatureRefs } from './useAudioFeatures';
import type { OrbPointerInteraction, OrbVisualState } from './orb-types';

// Canvas transparente para la ventana orbe. El rango de DPR evita gastar GPU
// en una ventana compacta; el diseño consigue contraste por capas, no por HDR
// saturado ni postprocesado.
export function OrbCanvas({ visualState, audio, motionEnabled = true }: { visualState: OrbVisualState; audio: AudioFeatureRefs; motionEnabled?: boolean }) {
  const invalidate = useRef<() => void>(() => undefined);
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
    invalidate.current();
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    hovered.current = false;
    if (!dragging.current) event.currentTarget.style.cursor = 'grab';
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.focus();
    dragging.current = true;
    velocity.current = { x: 0, y: 0 };
    lastPointer.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = 'grabbing';
  };

  const resetRotation = () => {
    rotation.current = { x: 0, y: 0 };
    velocity.current = { x: 0, y: 0 };
    invalidate.current();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); resetRotation(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    velocity.current = { x: 0, y: 0 };
    if (event.key === 'ArrowLeft') rotation.current.y -= 0.16;
    if (event.key === 'ArrowRight') rotation.current.y += 0.16;
    if (event.key === 'ArrowUp') rotation.current.x = THREE.MathUtils.clamp(rotation.current.x - 0.16, -1.35, 1.35);
    if (event.key === 'ArrowDown') rotation.current.x = THREE.MathUtils.clamp(rotation.current.x + 0.16, -1.35, 1.35);
    invalidate.current();
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
      tabIndex={0}
      role="group"
      aria-label="Orbe interactiva de SofLIA. Arrastra o usa las flechas para girar. Doble clic, Inicio o Enter para centrar."
      onKeyDown={handleKeyDown}
      onDoubleClick={resetRotation}
      onPointerMove={handlePointerMove}
      onPointerEnter={(event) => { hovered.current = true; event.currentTarget.style.cursor = 'grab'; }}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={() => { dragging.current = false; }}
    >
      <Canvas
        fallback={<p role="status">No se pudo iniciar WebGL para mostrar la orbe de SofLIA.</p>}
        frameloop={motionEnabled ? 'always' : 'demand'}
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
        onCreated={({ gl, invalidate: requestFrame }) => {
          invalidate.current = requestFrame;
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
