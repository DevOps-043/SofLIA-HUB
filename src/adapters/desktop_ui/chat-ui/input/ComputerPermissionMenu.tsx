import { useEffect, useState } from 'react';
import { computerPermissionMode } from '../../../../services/computer-use/permissions';
import type { ComputerPermissionMode } from '../../../../shared/computer-permissions';

const choices = [
  { mode: 'review', label: 'Aprobar por mí', detail: 'SofLIA aprueba acciones de bajo riesgo mediante reglas. Te consulta cuando necesita tu decisión.' },
  { mode: 'full', label: 'Acceso completo', detail: 'Permite actuar sin pedir aprobación en cada paso. Se guarda por cuenta en este equipo.' },
] as const;

export function ComputerPermissionMenu({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<ComputerPermissionMode>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void computerPermissionMode().then(result => {
      if (!active) return;
      setMode(result.mode);
      setError(result.error);
      setBusy(false);
    });
    return () => { active = false; };
  }, []);

  async function select(choice: ComputerPermissionMode) {
    setBusy(true);
    setError(undefined);
    const result = await computerPermissionMode(choice);
    if (result.mode) setMode(result.mode);
    setError(result.error);
    setBusy(false);
  }

  return (
    <section aria-label="Permisos de computadora" className="w-64 rounded-2xl border border-gray-200/50 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#161B22]">
      <button type="button" onClick={onBack} className="mb-1 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-white/80">‹ Volver</button>
      <div role="group" aria-label="Modo de permisos" aria-busy={busy}>
        {choices.map(choice => (
          <button key={choice.mode} type="button" aria-pressed={mode === choice.mode} disabled={busy}
            onClick={() => void select(choice.mode)}
            className="block w-full rounded-xl border border-transparent px-2 py-2 text-left hover:bg-gray-50 aria-pressed:border-accent/40 dark:hover:bg-white/5">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">{choice.label}</span>
            <span className="block text-xs text-gray-600 dark:text-white/70">{choice.detail}</span>
          </button>
        ))}
      </div>
      {error && <p role="status" className="px-2 py-1 text-xs text-gray-700 dark:text-white/80">{error}</p>}
    </section>
  );
}
