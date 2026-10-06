import { Users } from './activity-icons';
import { useAgentActivityPanel } from './agent-activity-context';

/** Acceso al panel de equipos integrado en la barra que lo aloja; no flota sobre otros controles. */
export function AgentActivityButton() {
  const panel = useAgentActivityPanel();
  if (!panel) return null;
  const label = panel.open ? 'Ocultar equipos de agentes' : 'Ver equipos de agentes';
  return <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={panel.open}
    onClick={panel.toggle}
    className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent [app-region:no-drag] [-webkit-app-region:no-drag] ${panel.open ? 'bg-accent/15 text-accent' : 'text-gray-500 hover:bg-black/5 hover:text-accent dark:text-gray-400 dark:hover:bg-white/10'}`}
  >
    <Users size={15} />
    {panel.runningCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />}
  </button>;
}
