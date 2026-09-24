import { useEffect, useState } from 'react';
import { Activity, Check, ChevronDown, ChevronUp, Circle, Clock3, Minimize2, Users, X } from './activity-icons';
import type { AgentActivity } from '../../shared/agent-activity';
import { agentActivityService } from '../../services/agent-activity';

const surfaces = { chat: 'Chat', whatsapp: 'WhatsApp', browser: 'Navegador', computer: 'Computer Use', meetings: 'Reuniones' };
const kinds = { analysis: 'Análisis', document: 'Documento', presentation: 'Presentación', browser: 'Revisión de página', computer: 'Plan de ejecución', meeting: 'Minuta' };
const roles: Record<string, string> = { analisis: 'Análisis', evidencia: 'Evidencia', 'analisis-pagina': 'Análisis de página', contenido: 'Contenido', estructura: 'Estructura', diseno: 'Diseño', plan: 'Planificación', verificacion: 'Verificación', acuerdos: 'Acuerdos', coordinador: 'Coordinador' };
const states = { pending: 'Pendiente', running: 'Trabajando', completed: 'Completado', failed: 'Falló', timed_out: 'Tiempo agotado', cancelled: 'Cancelado', skipped: 'Sin iniciar' };
const teamStates = { running: 'En progreso', completed: 'Aportes listos', partial: 'Resultado parcial', unavailable: 'Sin capacidad', cancelled: 'Cancelado' };

export function AgentActivityWindow() {
  const [items, setItems] = useState<AgentActivity[]>([]);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true; let changed = false;
    const remove = agentActivityService.subscribe(next => { changed = true; if (active) setItems(next); });
    void agentActivityService.snapshot().then(next => { if (active && !changed) setItems(next); }).catch(() => {
      if (active) setError('No se pudo cargar la actividad. Vuelve a abrir el monitor desde el Hub.');
    });
    return () => { active = false; remove(); };
  }, []);
  const control = (action: 'hide' | 'minimize') => {
    void agentActivityService.control(action).catch(() => setError('No se pudo cambiar la ventana.'));
  };
  const working = items.filter(item => item.status === 'running').length;
  return <main className="flex h-screen flex-col bg-background text-primary font-sans">
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><Users size={18} aria-hidden="true" /></span>
      <div className="flex-1"><h1 className="text-sm font-semibold">Equipo de SofLIA</h1><p className="text-xs text-secondary" role="status">{working ? `${working} ${working === 1 ? 'equipo trabajando' : 'equipos trabajando'}` : 'Actividad reciente'}</p></div>
      <button aria-label="Minimizar monitor" title="Minimizar" onClick={() => control('minimize')} className="rounded-lg p-2 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"><Minimize2 size={15} /></button>
      <button aria-label="Ocultar monitor" title="Ocultar sin detener agentes" onClick={() => control('hide')} className="rounded-lg p-2 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"><X size={16} /></button>
    </header>
    <section aria-label="Equipos de agentes" className="flex-1 overflow-y-auto p-3 space-y-3">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!items.length && <div className="px-6 py-12 text-center"><Users className="mx-auto mb-3 text-secondary" size={30} /><h2 className="text-sm font-medium">Sin equipos activos</h2><p className="mt-2 text-xs leading-5 text-secondary">Esta ventana se abre cuando los especialistas empiezan a trabajar.</p></div>}
      {items.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <button aria-expanded={!collapsed[item.id]} onClick={() => setCollapsed(prev => ({ ...prev, [item.id]: !prev[item.id] }))} className="flex w-full items-center gap-2 p-3 text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent">
          <Activity size={15} className={item.status === 'running' ? 'text-accent' : 'text-secondary'} />
          <span className="min-w-0 flex-1"><span className="block text-xs text-secondary">{surfaces[item.surface]}</span><span className="block text-sm font-semibold">{kinds[item.kind]}</span></span>
          <span className="text-xs text-secondary">{teamStates[item.status]}</span>
          {collapsed[item.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {!collapsed[item.id] && <ul className="space-y-1 border-t border-border p-2">
          {item.agents.map(agent => <li key={agent.role} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            {agent.status === 'completed' ? <Check size={15} className="text-success" /> : agent.status === 'running' ? <span className="h-2.5 w-2.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" /> : <Circle size={12} className="text-secondary" />}
            <span className="flex-1 text-sm">{roles[agent.role] ?? agent.role}</span><span className="text-xs text-secondary">{states[agent.status]}</span>
          </li>)}
        </ul>}
        <p className="flex items-center gap-1.5 px-3 pb-3 text-xs text-secondary"><Clock3 size={12} />{(item.durationMs / 1000).toFixed(1)} s observados · {item.agents.filter(agent => agent.status === 'completed').length}/{item.agents.length} completados</p>
      </article>)}
    </section>
    <footer className="border-t border-border bg-card px-4 py-3 text-xs leading-5 text-secondary">Los aportes listos no significan que la tarea principal haya terminado. Ocultar esta ventana no detiene el trabajo.</footer>
  </main>;
}
