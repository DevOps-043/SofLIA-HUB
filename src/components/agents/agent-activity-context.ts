import { createContext, useContext } from 'react';
import type { AgentActivity } from '../../shared/agent-activity';

export interface AgentActivityPanelState {
  items: AgentActivity[];
  error: string;
  open: boolean;
  runningCount: number;
  setOpen(open: boolean): void;
  toggle(): void;
}

export const AgentActivityContext = createContext<AgentActivityPanelState | null>(null);

/** Devuelve null fuera del proveedor para que los controles puedan omitirse sin fallar. */
export function useAgentActivityPanel(): AgentActivityPanelState | null {
  return useContext(AgentActivityContext);
}

/**
 * Un equipo nuevo en curso abre el panel una sola vez: si el usuario lo cierra,
 * las actualizaciones posteriores del mismo equipo ya no lo reabren.
 */
export function hasNewRunningTeam(previousIds: ReadonlySet<string>, items: readonly AgentActivity[]): boolean {
  return items.some(item => item.status === 'running' && !previousIds.has(item.id));
}
