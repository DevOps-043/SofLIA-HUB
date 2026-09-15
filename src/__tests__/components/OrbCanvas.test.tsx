import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { OrbPointerInteraction } from '../../components/orb/orb-types';
import { OrbCanvas } from '../../components/orb/OrbCanvas';

const captured = vi.hoisted(() => ({ interaction: null as OrbPointerInteraction | null, frameloop: '' }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children, frameloop }: { children: ReactNode; frameloop: string }) => {
  captured.frameloop = frameloop;
  return <div>{children}</div>;
} }));
vi.mock('../../components/orb/OrbMesh', () => ({ OrbMesh: ({ interaction }: { interaction: OrbPointerInteraction }) => {
  captured.interaction = interaction; return <div data-testid="original-orb-mesh" />;
} }));
const audio = { level: { current: 0 }, tone: { current: 0.4 }, bands: { current: new Float32Array(8) } };

describe('interacción de la orbe original compartida', () => {
  beforeEach(() => { captured.interaction = null; });
  it('mantiene la malla del producto y animación por defecto', () => {
    render(<OrbCanvas visualState="idle" audio={audio} />);
    expect(screen.getByTestId('original-orb-mesh')).toBeInTheDocument();
    expect(captured.frameloop).toBe('always');
    expect(screen.getByRole('group')).toHaveAttribute('tabindex', '0');
  });
  it('pausa render continuo y admite flechas con límites y recentrado', () => {
    render(<OrbCanvas visualState="idle" audio={audio} motionEnabled={false} />);
    expect(captured.frameloop).toBe('demand');
    const surface = screen.getByRole('group');
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(captured.interaction!.rotation.current.y).toBeCloseTo(.16);
    for (let i = 0; i < 30; i++) fireEvent.keyDown(surface, { key: 'ArrowUp' });
    expect(captured.interaction!.rotation.current.x).toBe(-1.35);
    fireEvent.keyDown(surface, { key: 'Home' });
    expect(captured.interaction!.rotation.current).toEqual({ x: 0, y: 0 });
  });
  it('doble clic reinicia giro e inercia sin acciones externas', () => {
    render(<OrbCanvas visualState="thinking" audio={audio} />);
    captured.interaction!.rotation.current = { x: 1, y: 3 };
    captured.interaction!.velocity.current = { x: 2, y: 4 };
    fireEvent.doubleClick(screen.getByRole('group'));
    expect(captured.interaction!.rotation.current).toEqual({ x: 0, y: 0 });
    expect(captured.interaction!.velocity.current).toEqual({ x: 0, y: 0 });
  });
  it('perder captura finaliza el arrastre', () => {
    render(<OrbCanvas visualState="idle" audio={audio} />);
    captured.interaction!.dragging.current = true;
    fireEvent.lostPointerCapture(screen.getByRole('group'));
    expect(captured.interaction!.dragging.current).toBe(false);
  });
});
