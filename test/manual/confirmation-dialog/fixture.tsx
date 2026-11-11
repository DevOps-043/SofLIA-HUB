import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfirmActionModal } from '../../../src/components/ConfirmActionModal';
import '../../../src/index.css';

type Request = { id: number; description: string; always: boolean; toolName: string };
declare global {
  interface Window {
    confirmationSmoke?: { open(long?: boolean, always?: boolean, toolName?: string): void; replace(): void; close(): void };
  }
}
export function Fixture() {
  const [request, setRequest] = useState<Request | null>(null);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(0), [shortcuts, setShortcuts] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    window.confirmationSmoke = {
      open: (long = false, always = true, toolName = 'execute_command') => setRequest({ id: ++sequence.current, always, toolName,
        description: 'Ejecutar comando: ' + (long ? 'Texto local ficticio para revisión extensa. '.repeat(160) : 'mostrar ejemplo ficticio') }),
      replace: () => setRequest(current => current ? { ...current, id: ++sequence.current } : current),
      close: () => setRequest(null),
    };
    return () => { delete window.confirmationSmoke; };
  }, []);
  const decide = (decision: string) => {
    setDecisions(current => [...current, decision]);
    setRequest(current => current?.id === request?.id ? null : current);
  };
  return <main onKeyDown={() => setShortcuts(current => current + 1)} className="p-8">
    <h1>Prueba local de confirmación</h1>
    <button id="open" type="button" onClick={() => window.confirmationSmoke?.open()}>Abrir confirmación</button>
    <button id="background" type="button">Acción de fondo</button>
    <output id="decisions">{decisions.join(',')}</output><output id="submitted">{submitted}</output><output id="shortcuts">{shortcuts}</output>
    <form onSubmit={event => { event.preventDefault(); setSubmitted(current => current + 1); }}>
      <ConfirmActionModal isOpen={request !== null} toolName={request?.toolName ?? 'execute_command'} description={request?.description ?? ''}
        requestId={request?.id} onConfirm={() => decide('confirmar')}
        onAlways={request?.always ? () => decide('siempre') : undefined} onCancel={() => decide('cancelar')} />
    </form>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
