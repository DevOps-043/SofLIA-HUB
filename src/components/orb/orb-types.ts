import type { MutableRefObject } from 'react';

// Tipos compartidos de la Orbe de Voz.

/** Estado de la conversación (state machine de useOrbConversation). */
export type OrbConversationState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'acting'
  | 'speaking'
  | 'info';

/** Estado visual de la orbe (subconjunto que afecta shader/colores). */
export type OrbVisualState = 'idle' | 'listening' | 'thinking' | 'acting' | 'speaking';

export interface OrbPointerInteraction {
  rotation: MutableRefObject<{ x: number; y: number }>;
  velocity: MutableRefObject<{ x: number; y: number }>;
  hovered: MutableRefObject<boolean>;
  dragging: MutableRefObject<boolean>;
}

export function toVisualState(state: OrbConversationState, ttsPlaying: boolean): OrbVisualState {
  if (state === 'info') return ttsPlaying ? 'speaking' : 'idle';
  return state;
}
