import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallerOrb } from '../../installer-orb/InstallerOrb';
import { parseOrbState } from '../../installer-orb/orb-state';

vi.mock('../../components/orb/OrbCanvas', () => ({ OrbCanvas: ({ visualState, motionEnabled, audio }: { visualState: string; motionEnabled: boolean; audio: { level: { current: number } } }) =>
  <div data-testid="shared-orb" data-state={visualState} data-motion={String(motionEnabled)} data-audio={audio.level.current} /> }));

describe('orbe del instalador sin herramientas ni micrófono', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it.each([null, [], {}, 'instalar', { type: 'installer-orb-state', motion: 'true', visualState: 'idle' }, { type: 'installer-orb-state', motion: true, visualState: 'speaking' }])('ignora mensaje ajeno %j', value => {
    expect(parseOrbState(value)).toBeNull();
  });
  it('valida exclusivamente estados gráficos', () => {
    expect(parseOrbState({ type: 'installer-orb-state', motion: false, visualState: 'thinking' })).toEqual({ motion: false, visualState: 'thinking' });
  });
  it('escucha estados del host y retira el listener al desmontar', () => {
    let listener: ((event: MessageEvent) => void) | undefined;
    const remove = vi.fn();
    vi.stubGlobal('chrome', { webview: { addEventListener: vi.fn((_type, next) => { listener = next; }), removeEventListener: remove } });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const { unmount } = render(<InstallerOrb />);
    expect(screen.getByTestId('shared-orb')).toHaveAttribute('data-state', 'idle');
    expect(screen.getByTestId('shared-orb')).toHaveAttribute('data-audio', '0');
    act(() => listener!(new MessageEvent('message', { data: { type: 'installer-orb-state', motion: false, visualState: 'thinking' } })));
    expect(screen.getByTestId('shared-orb')).toHaveAttribute('data-state', 'thinking');
    expect(screen.getByTestId('shared-orb')).toHaveAttribute('data-motion', 'false');
    unmount();
    expect(remove).toHaveBeenCalledWith('message', listener);
  });
});
