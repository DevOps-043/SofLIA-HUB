import { BROWSER_HANDOFF_MESSAGES, type BrowserSensitiveHandoff } from '../../shared/browser-sensitive-handoff';

export function BrowserSensitiveHandoffNotice({ handoff }: { handoff?: BrowserSensitiveHandoff | null }) {
  if (!handoff) return null;
  return <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
    <p className="font-semibold">Continúa manualmente en esta página</p>
    <p>{BROWSER_HANDOFF_MESSAGES[handoff.reason] ?? BROWSER_HANDOFF_MESSAGES.uninspectable}</p>
    <p>Se bloquearon nuevas lecturas y acciones del agente. Si había una operación en curso, espera a que termine de detenerse. Completa lo necesario tú mismo; para volver a usar el agente, abre otro documento no sensible. Este aviso no autoriza capturas del escritorio.</p>
  </div>;
}
