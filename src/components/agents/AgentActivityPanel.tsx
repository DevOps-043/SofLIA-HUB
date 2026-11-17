import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, FileText, X } from './activity-icons';
import type { AgentActivity } from '../../shared/agent-activity';
import { teamStatusLabels } from '../../shared/background-team-display';
import { useAgentActivityPanel } from './agent-activity-context';
import { useResizablePanel } from '../artifacts/useResizablePanel';
import { PanelResizeGrip } from '../PanelResizeGrip';
import { BackgroundJobControls } from './BackgroundJobControls';
import './agent-activity.css';

const surfaces = { chat: 'Chat', orb: 'Orbe', whatsapp: 'WhatsApp', browser: 'Navegador', computer: 'Computer Use', meetings: 'Reuniones' };
const kinds = { analysis: 'Análisis', document: 'Documento', presentation: 'Presentación', browser: 'Revisión de página', computer: 'Trabajo en pantalla', meeting: 'Minuta' };
const states = { running: 'En progreso', completed: 'Listo', partial: 'Resultado parcial', unavailable: 'Pendiente', cancelled: 'Cancelado' };

/** El monitor presenta entregables; los registros de ejecución pertenecen al runtime. */
export function AgentActivityPanel({ className = '', style, onWidthChange, reserve = 0 }: { className?: string; style?: CSSProperties; onWidthChange?: (width: number) => void; reserve?: number }) {
  const panel = useAgentActivityPanel();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [scopeFilter, setScopeFilter] = useState<'all' | 'current'>('all');
  const { bindPanel, width, resizing, minimum, maximum, handlers } = useResizablePanel({ storageKey: 'soflia:files-panel-width', initialWidth: 380, maxWidth: 640, reserve, enabled: Boolean(panel?.open) });
  const open = panel?.open;
  const setOpen = panel?.setOpen;
  useEffect(() => { if (open) onWidthChange?.(width); }, [onWidthChange, open, width]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen?.(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open, setOpen]);
  if (!panel?.open) return null;
  const { items, error, runningCount } = panel;
  const visibleItems = scopeFilter === 'all' ? items : items.filter(item => (item.execution?.conversationId ?? item.origin?.conversationId) === panel.activeConversationId);
  const files = items.reduce((count, item) => count + (item.execution?.artifacts.length ?? 0), 0);
  return <aside ref={bindPanel} aria-label="Archivos de SofLIA" className={`agent-activity-panel ${resizing ? 'resizing' : ''} ${className}`} style={{ ...style, width: width }}>
    <div role="separator" tabIndex={0} aria-label="Cambiar ancho de archivos" title="Arrastra para ajustar el ancho" aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width} className="artifact-resize-handle group" {...handlers}><PanelResizeGrip resizing={resizing} /></div>
    <header className="agent-activity-header">
      <span className="agent-activity-heading-icon"><FileText size={19} /></span>
      <div><h2>Archivos</h2><p role="status">{runningCount ? 'Preparando resultados…' : files ? `${files} ${files === 1 ? 'archivo disponible' : 'archivos disponibles'}` : 'Tu espacio de trabajo'}</p></div>
      <button type="button" aria-label="Ocultar panel de archivos" title="Cerrar panel" onClick={() => panel.setOpen(false)}><X size={16} /></button>
    </header>
    <nav className="flex gap-2 px-4 py-2 text-xs" aria-label="Filtrar trabajos por conversación">
      <button type="button" aria-pressed={scopeFilter === 'current'} onClick={() => setScopeFilter('current')}>Este chat</button>
      <button type="button" aria-pressed={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>Todos</button>
    </nav>
    <section aria-label="Trabajos y archivos" aria-live="polite" className="agent-activity-scroll">
      {error && <p role="alert" className="team-operation-error">{error}</p>}
      {!visibleItems.length && <div className="agent-activity-empty"><FileText size={32} /><h3>Tus archivos, a mano</h3><p>{scopeFilter === 'current' ? 'Este chat todavía no tiene trabajos. Puedes consultar los de otras conversaciones en Todos.' : 'Los documentos y resultados de SofLIA aparecerán aquí.'}</p></div>}
      {visibleItems.map(item => <FileGroup key={item.id} item={item} collapsed={Boolean(collapsed[item.id])} onToggle={() => setCollapsed(previous => ({ ...previous, [item.id]: !previous[item.id] }))} />)}
    </section>
  </aside>;
}
function FileGroup({ item, collapsed, onToggle }: { item: AgentActivity; collapsed: boolean; onToggle: () => void }) {
  const panel = useAgentActivityPanel();
  const origin = item.execution?.conversationId ?? item.origin?.conversationId;
  const title = origin ? panel?.conversationTitles?.[origin] : undefined;
  return <article className="agent-activity-team">
    <button type="button" aria-expanded={!collapsed} onClick={onToggle} className="agent-file-group-heading">
      <span className="agent-file-group-copy"><span className="agent-file-group-origin">{surfaces[item.surface]}</span><strong>{item.execution?.title ?? kinds[item.kind]}</strong></span>
      {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
    </button>
    <p className="agent-file-group-note">{item.execution ? 'Trabajo en segundo plano' : 'Preparación del turno'}</p>
    {origin && title && panel?.openConversation
      ? <button type="button" className="text-xs text-accent underline underline-offset-2" onClick={() => panel.openConversation?.(origin)}>Abrir chat: {title}</button>
      : <p className="agent-file-group-note">{origin ? 'Conversación de origen no disponible en esta vista.' : 'El registro anterior no conserva su conversación de origen.'}</p>}
    <p className="agent-file-group-status">{item.status === 'running' && <span className="team-spinner" />}{item.execution ? teamStatusLabels[item.execution.status] : item.status === 'completed' ? 'Aportes preparados' : states[item.status]}</p>
    {!collapsed && (item.execution ? <BackgroundJobControls execution={item.execution} /> : <p className="agent-file-group-note">{item.status === 'running' ? 'Preparando aportes para el turno de origen…' : 'Estos aportes pertenecen al turno de origen; su preparación no confirma que el entregable esté terminado.'}</p>)}
  </article>;
}
