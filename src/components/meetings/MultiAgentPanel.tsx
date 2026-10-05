import { useEffect, useRef, useState } from 'react';
import { agentResult, agentRuntimeBridge } from '../../services/agent-runtime';
import type { AgentProviderId, AgentRunStatus, AgentRuntimeState } from '../../shared/agent-runtime';

const statusLabels: Record<AgentRunStatus, string> = {
  running: 'Analizando', review: 'Listo para revisar', cancelled: 'Interrumpido',
  failed: 'Falló el análisis', interrupted: 'Recuperación disponible', publishing: 'Creando borrador',
  published: 'Borrador creado', uncertain: 'Comprueba el resultado en Meeting Ops',
};
export function MultiAgentPanel(props: {
  userId: string; organizationId: string | null; title: string; source: string; onPublished(): void;
}) {
  const [state, setState] = useState<AgentRuntimeState | null>(null);
  const [provider, setProvider] = useState<AgentProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [contextAttempt, setContextAttempt] = useState(0);
  const epoch = useRef(0);
  useEffect(() => {
    const generation = ++epoch.current;
    let disposed = false;
    let fetching = false;
    let dirty = false;
    const refresh = async () => {
      if (disposed) return;
      if (fetching) { dirty = true; return; }
      fetching = true;
      try {
        do {
          dirty = false;
          const next = await agentResult(agentRuntimeBridge().getState());
          if (!disposed && generation === epoch.current) setState(next);
        } while (dirty && !disposed);
      } catch {
        if (!disposed) { setState(null); setError('No se pudo actualizar el análisis. Comprueba tu sesión.'); }
      }
      finally { fetching = false; }
    };
    let unsubscribe = () => {};
    try {
      const bridge = agentRuntimeBridge();
      void agentResult(bridge.setContext({ organizationId: props.organizationId }))
        .then(next => {
          if (!disposed && generation === epoch.current) {
            setState(next);
            setError('');
            unsubscribe = bridge.onChanged(() => { void refresh(); });
          }
        })
        .catch(() => { if (!disposed) setError('No se pudo abrir el análisis en este contexto. Comprueba tu sesión y organización.'); });
    } catch (caught) {
      queueMicrotask(() => { if (!disposed) setError(caught instanceof Error ? caught.message : 'Arnés no disponible.'); });
    }
    return () => {
      disposed = true;
      epoch.current = generation + 1;
      unsubscribe();
      // Salir del contexto cancela su trabajo y retira las confirmaciones.
      if (window.agentRuntime) void window.agentRuntime.releaseContext().catch(() => undefined);
    };
  }, [props.userId, props.organizationId, contextAttempt]);
  const run = state?.runs.find(item => item.id === selected) ?? state?.runs[state.runs.length - 1];
  useEffect(() => {
    if (!run?.approvalExpiresAt) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, run.approvalExpiresAt - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [run?.approvalExpiresAt]);
  const expired = (run?.approvalExpiresAt ?? 0) < now;
  const active = state?.runs.some(item => item.status === 'running' || item.status === 'publishing');
  const act = async (action: (isCurrent: () => boolean) => Promise<unknown>) => {
    const generation = epoch.current;
    setBusy(true); setError('');
    try {
      await action(() => generation === epoch.current);
      if (generation !== epoch.current) return;
      const next = await agentResult(agentRuntimeBridge().getState());
      if (generation === epoch.current) setState(next);
    } catch (caught) {
      if (generation === epoch.current) setError(caught instanceof Error ? caught.message : 'No se pudo completar la operación.');
    } finally { if (generation === epoch.current) setBusy(false); }
  };
  return <section className="mx-6 mb-6 rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3" aria-label="Análisis en equipo">
    <h3 className="font-semibold">Análisis en equipo</h3>
    <p className="text-sm opacity-70">Dos especialistas revisan acuerdos y evidencia; un coordinador prepara la minuta. Usa el título y la transcripción del formulario superior.</p>
    {error && <div>
      <p role="alert" className="text-sm text-red-600">{error}</p>
      <button disabled={busy} onClick={() => setContextAttempt(value => value + 1)}>Recargar panel y detener el análisis pendiente</button>
    </div>}
    {state?.persistence === 'volatile' && <p role="status" className="text-sm">Sin cifrado disponible: el historial solo se conserva durante esta sesión.</p>}
    <div className="flex flex-wrap items-center gap-3">
      <label>Proveedor <select aria-label="Proveedor del equipo" value={provider} onChange={event => setProvider(event.target.value as AgentProviderId)} disabled={busy || active} className="bg-transparent border rounded p-1">
        <option value="gemini">Gemini</option><option value="codex">Codex</option>
      </select></label>
      <button disabled={!state || busy || active || props.source.trim().length < 10 || !props.title.trim() || (provider === 'gemini' ? !state.geminiAvailable : !state.codex.configured)}
        onClick={() => void act(async isCurrent => {
          const next = await agentResult(agentRuntimeBridge().start({ title: props.title, source: props.source, provider }));
          if (isCurrent()) { setSelected(next.id); setConfirmed(false); }
        })} className="rounded bg-accent px-3 py-2 text-white disabled:opacity-40">Analizar en equipo</button>
      {run?.status === 'running' && <button onClick={() => void act(() => agentResult(agentRuntimeBridge().cancel({ runId: run.id })))} disabled={busy}>Detener</button>}
    </div>
    {provider === 'codex' && <details className="text-sm">
      <summary>Configurar Codex {state?.codex.version ? '(' + state.codex.version + ')' : ''}</summary>
      <p className="my-2">Selecciona Codex instalado y configura una clave API de OpenAI para este usuario y organización. El proveedor puede generar consumo facturable.</p>
      <button disabled={!state || busy || active} onClick={() => void act(() => agentResult(agentRuntimeBridge().configureCodex()))}>Seleccionar ejecutable</button>
      <label className="block mt-2">Clave API <input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} className="bg-transparent border rounded p-1" /></label>
      <button disabled={!state || busy || active || !apiKey.trim()} onClick={() => void act(async () => {
        await agentResult(agentRuntimeBridge().setCodexKey({ apiKey })); setApiKey('');
      })}>Guardar clave</button>
      <button disabled={!state || busy || active} onClick={() => void act(() => agentResult(agentRuntimeBridge().setCodexKey({ apiKey: '' })))}>Retirar clave</button>
    </details>}
    {state && !state.geminiAvailable && provider === 'gemini' && <p className="text-sm">Configura la clave Gemini en los ajustes de SofLIA.</p>}
    {!!state?.runs.length && <label className="block text-sm">Historial <select aria-label="Historial de análisis" value={run?.id ?? ''} className="bg-transparent border rounded p-1 max-w-full" onChange={event => { setSelected(event.target.value); setConfirmed(false); }}>
      {state.runs.map(item => <option key={item.id} value={item.id}>{item.title} — {statusLabels[item.status]}</option>)}
    </select></label>}
    {run && <div className="space-y-3">
      <p role="status">{statusLabels[run.status]}</p>
      {run.error && <p className="text-sm">{run.error}</p>}
      {run.steps.map(step => <details key={step.role} open={step.role === 'coordinador' && step.status === 'completed'}>
        <summary>{step.role === 'acuerdos' ? 'Acuerdos' : step.role === 'evidencia' ? 'Evidencia' : 'Minuta'} · {({ pending: 'pendiente', running: 'trabajando', completed: 'completado', failed: 'falló', cancelled: 'interrumpido' })[step.status]}</summary>
        <pre className="whitespace-pre-wrap font-sans text-sm p-2">{step.output || 'Sin resultado todavía.'}</pre>
        <p className="text-xs opacity-60">Tokens observados: {step.inputTokens + step.outputTokens}. Consultas: {step.toolCalls}.</p>
      </details>)}
      {(['interrupted', 'failed', 'cancelled'].includes(run.status) || (run.status === 'review' && expired)) && <button disabled={busy || active} onClick={() => void act(async isCurrent => {
        const next = await agentResult(agentRuntimeBridge().recover({ runId: run.id }));
        if (isCurrent()) { setSelected(next.id); setConfirmed(false); }
      })}>Recuperar análisis</button>}
      {run.status === 'review' && run.digest && <div className="space-y-2">
        <label className="block text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Revisé esta minuta y autorizo crear un borrador en Meeting Ops.</label>
        <button disabled={busy || !confirmed || expired} onClick={() => void act(async isCurrent => {
          const published = await agentResult(agentRuntimeBridge().publish({ runId: run.id, digest: run.digest! }));
          if (isCurrent()) {
            setConfirmed(false);
            if (published.status === 'published') props.onPublished();
          }
        })} className="rounded bg-accent px-3 py-2 text-white disabled:opacity-40">Crear borrador revisable</button>
        <p className="text-xs opacity-70">El borrador conserva la revisión y las aprobaciones de Meeting Ops. Esta confirmación vence a los 10 minutos.</p>
      </div>}
    </div>}
  </section>;
}
