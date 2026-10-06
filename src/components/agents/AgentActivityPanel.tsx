import { useState, type CSSProperties } from 'react';
import { Activity, Check, ChevronDown, ChevronUp, Circle, Clock3, Users, X } from './activity-icons';
import type { AgentActivity } from '../../shared/agent-activity';
import { useAgentActivityPanel } from './agent-activity-context';

const surfaces = { chat: 'Chat', orb: 'Orbe', whatsapp: 'WhatsApp', browser: 'Navegador', computer: 'Computer Use', meetings: 'Reuniones' };
const kinds = { analysis: 'Análisis', document: 'Documento', presentation: 'Presentación', browser: 'Revisión de página', computer: 'Plan de ejecución', meeting: 'Minuta' };
const roles: Record<string, string> = { analisis: 'Análisis', evidencia: 'Evidencia', 'analisis-pagina': 'Análisis de página', contenido: 'Contenido', estructura: 'Estructura', diseno: 'Diseño', plan: 'Planificación', verificacion: 'Verificación', acuerdos: 'Acuerdos', coordinador: 'Coordinador' };
const states = { pending: 'Pendiente', running: 'Trabajando', completed: 'Completado', failed: 'Falló', timed_out: 'Tiempo agotado', cancelled: 'Cancelado', skipped: 'Sin iniciar' };
const teamStates = { running: 'En progreso', completed: 'Aportes listos', partial: 'Resultado parcial', unavailable: 'Sin capacidad', cancelled: 'Cancelado' };

/**
 * Panel acoplado del monitor de equipos. Quien lo monta decide su posición;
 * el panel sólo presenta el estado compartido y no renderiza nada si está cerrado.
 */
export function AgentActivityPanel({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const panel = useAgentActivityPanel();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (!panel?.open) return null;
  const { items, error, runningCount } = panel;
  const toggleTeam = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  return <aside aria-label="Equipo de SofLIA" className={`flex min-h-0 flex-col overflow-hidden bg-card text-primary ${className}`} style={{ fontFamily: 'var(--font-system-ui)', ...style }}>
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-3">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent"><Users size={15} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13px] font-semibold leading-tight">Equipo de SofLIA</h2>
        <p className="truncate text-[11px] leading-tight text-secondary" role="status">{runningCount ? `${runningCount} ${runningCount === 1 ? 'equipo trabajando' : 'equipos trabajando'}` : 'Actividad reciente'}</p>
      </div>
      <button type="button" aria-label="Ocultar panel de equipos" title="Ocultar sin detener agentes" onClick={() => panel.setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-secondary transition hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={15} /></button>
    </header>
    <section aria-label="Equipos de agentes" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
      {error && <p role="alert" className="px-1 text-xs text-danger">{error}</p>}
      {!items.length && <div className="px-5 py-10 text-center">
        <Users className="mx-auto mb-2.5 text-secondary" size={26} />
        <h3 className="text-[13px] font-medium">Sin equipos activos</h3>
        <p className="mt-1.5 text-xs leading-5 text-secondary">Este panel se abre cuando los especialistas empiezan a trabajar.</p>
      </div>}
      {items.map(item => <TeamCard key={item.id} item={item} collapsed={Boolean(collapsed[item.id])} onToggle={() => toggleTeam(item.id)} />)}
    </section>
    <footer className="shrink-0 border-t border-border px-3 py-2 text-[11px] leading-4 text-secondary">Los aportes listos no significan que la tarea principal haya terminado. Ocultar este panel no detiene el trabajo.</footer>
  </aside>;
}

function TeamCard({ item, collapsed, onToggle }: { item: AgentActivity; collapsed: boolean; onToggle: () => void }) {
  const completed = item.agents.filter(agent => agent.status === 'completed').length;
  return <article className="overflow-hidden rounded-xl border border-border bg-background/60 dark:bg-background-dark/60">
    <button type="button" aria-expanded={!collapsed} onClick={onToggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <Activity size={14} className={item.status === 'running' ? 'text-accent' : 'text-secondary'} />
      <span className="min-w-0 flex-1"><span className="block text-[11px] text-secondary">{surfaces[item.surface]}</span><span className="block truncate text-[13px] font-semibold">{kinds[item.kind]}</span></span>
      <span className="text-[11px] text-secondary">{teamStates[item.status]}</span>
      {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
    </button>
    {!collapsed && <ul className="space-y-1 border-t border-border p-1.5">
      {item.agents.map(agent => <li key={agent.role} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-1.5">
        {agent.status === 'completed' ? <Check size={14} className="text-success" /> : agent.status === 'running' ? <span className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" /> : <Circle size={11} className="text-secondary" />}
        <span className="flex-1 text-[13px]">{roles[agent.role] ?? agent.role}</span><span className="text-[11px] text-secondary">{states[agent.status]}</span>
      </li>)}
    </ul>}
    <p className="flex items-center gap-1.5 px-2.5 pb-2 pt-1 text-[11px] text-secondary"><Clock3 size={11} />{(item.durationMs / 1000).toFixed(1)} s observados · {completed}/{item.agents.length} completados</p>
  </article>;
}
