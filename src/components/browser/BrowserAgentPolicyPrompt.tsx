import { useCallback, useEffect, useState } from 'react';
import { integratedBrowserService, type BrowserAgentPolicyPromptRequest, type BrowserAgentSiteDecision } from '../../services/integrated-browser-service';

export function BrowserAgentPolicyPrompt({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [queue, setQueue] = useState<BrowserAgentPolicyPromptRequest[]>([]);
  const active = queue[0] ?? null;

  useEffect(() => integratedBrowserService.subscribe({
    onAgentPolicyPrompt: (request) => setQueue((current) => current.some((item) => item.id === request.id) ? current : [...current, request]),
    onStateChanged: (state) => {
      const ids = state.agentPolicyPromptIds;
      if (ids) setQueue(current => current.filter(item => ids.includes(item.id)));
    },
  }), []);
  useEffect(() => { onOpenChange?.(Boolean(active)); }, [active, onOpenChange]);

  const decide = useCallback((request: BrowserAgentPolicyPromptRequest, decision: BrowserAgentSiteDecision) => {
    setQueue((current) => current.filter((item) => item.id !== request.id));
    if (decision !== 'allow-once' && decision !== 'allow-always' && decision !== 'block') return;
    void integratedBrowserService.decideAgentPolicy({ id: request.id, decision }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') decide(active, 'block'); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [active, decide]);

  if (!active) return null;
  return <div role="dialog" aria-modal="false" aria-label="Permiso de SofLIA" className="absolute left-0 top-[calc(100%+0.375rem)] z-[95] w-full max-w-[30rem] rounded-2xl border border-accent/20 bg-white/98 p-4 shadow-xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#161b22]/98">
    <p className="text-sm font-semibold text-gray-900 dark:text-white/90">¿Permitir que SofLIA pueda {active.label}?</p>
    <p className="mt-1 truncate text-xs text-gray-500" title={active.origin}>{active.origin}</p>
    <p className="mt-2 text-xs text-secondary">La autorización aplica sólo al sitio mostrado. Puedes permitir esta vez, recordar la decisión o bloquear.</p>
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <button type="button" className="soflia-browser-button px-3" onClick={() => decide(active, 'block')}>Bloquear</button>
      <button type="button" autoFocus className="soflia-browser-button px-3" onClick={() => decide(active, 'allow-once')}>Permitir esta vez</button>
      <button type="button" className="soflia-browser-button soflia-browser-button--primary px-3" onClick={() => decide(active, 'allow-always')}>Permitir siempre</button>
    </div>
  </div>;
}
