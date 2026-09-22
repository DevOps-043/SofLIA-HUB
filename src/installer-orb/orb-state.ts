import type { OrbVisualState } from '../components/orb/orb-types';

export interface InstallerOrbState { visualState: OrbVisualState; motion: boolean }

export function parseOrbState(value: unknown): InstallerOrbState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (state.type !== 'installer-orb-state' || typeof state.motion !== 'boolean' || typeof state.visualState !== 'string'
    || !['idle', 'thinking', 'acting'].includes(state.visualState)) return null;
  return { visualState: state.visualState as OrbVisualState, motion: state.motion };
}
