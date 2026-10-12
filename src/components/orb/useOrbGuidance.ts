import { useEffect, useState } from 'react';
import { orbGuidanceService } from '../../services/orb-guidance-service';
import { initialGuidanceState, type GuidanceControl, type GuidanceState } from '../../shared/orb-guidance';

export function useOrbGuidance() {
  const [state, setState] = useState(initialGuidanceState);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!orbGuidanceService.available()) return;
    let current = true;
    const apply = (next: GuidanceState) => {
      if (current) setState(previous => next.revision >= previous.revision ? next : previous);
    };
    const unsubscribe = orbGuidanceService.onState(apply);
    void orbGuidanceService.getState().then(result => { if (result.state) apply(result.state); }).catch(() => undefined);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => { void orbGuidanceService.control({ action: 'motion', reduced: reduced?.matches ?? false }).catch(() => undefined); };
    motion(); reduced?.addEventListener?.('change', motion);
    return () => { current = false; unsubscribe(); reduced?.removeEventListener?.('change', motion); };
  }, []);
  const control = async (input: GuidanceControl) => {
    try { const result = await orbGuidanceService.control(input); setError(result.success ? null : result.error ?? 'No se pudo aplicar el control.'); }
    catch { setError('No se pudo actualizar la asistencia.'); }
  };
  const check = async () => {
    try { const result = await orbGuidanceService.checkPractice(); setError(result.success ? null : result.error ?? 'No se pudo comprobar el paso.'); }
    catch { setError('No se pudo comprobar el paso.'); }
  };
  return { state, error, control, check };
}
