import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectedStudio } from '../../../src/components/learning-live/ConnectedStudio';
import '../../../src/index.css';
import type { StudioResult } from '../../../src/shared/live-studio.contract';

const actor = new URLSearchParams(location.search).get('actor') === 'alumno' ? 'alumno' : 'instructor';
let events: EventSource | null = null;
const listeners = new Set<(notice: unknown) => void>();
const reference = { organization_slug: 'prueba', session_id: '00000000-0000-4000-8000-000000000031' };
window.learningLive = {
  studio: async (ref, operation) => (await fetch(`/__studio?actor=${actor}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, operation }) })).json() as Promise<StudioResult>,
  onStudioEvent: (callback) => { listeners.add(callback); return () => { listeners.delete(callback); }; },
  watchStudio: async () => {
    events?.close(); events = new EventSource(`/__studio-events?actor=${actor}`);
    events.onmessage = (event) => { for (const listener of listeners) listener({ session_id: reference.session_id, status: event.data }); };
    events.onerror = () => { for (const listener of listeners) listener({ session_id: reference.session_id, status: 'disconnected' }); };
    return { success: true };
  },
  unwatchStudio: async () => { events?.close(); events = null; },
  workspace: async () => { throw new Error('No se usa el aula anterior en esta prueba'); },
  open: async () => ({ success: false, error: 'Usa Learning para el acceso real' }),
  getPending: async () => null, onRequested: () => () => {},
};
export function Preview() {
  const [dark, setDark] = useState(false), [open, setOpen] = useState(true);
  document.documentElement.classList.toggle('dark', dark);
  return <div className="flex h-screen flex-col bg-background text-primary"><header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs"><span>Datos de ejemplo · {actor} · estado compartido hasta reiniciar el servidor · sin Zoom real</span><div className="flex gap-4"><a href="/?actor=instructor" target="_blank" rel="noreferrer">Instructor</a><a href="/?actor=alumno" target="_blank" rel="noreferrer">Participante</a><button onClick={() => setDark(!dark)}>{dark ? 'Modo claro' : 'Modo oscuro'}</button></div></header><div className="flex min-h-0 flex-1">{open ? <ConnectedStudio reference={reference} onClose={() => setOpen(false)} onBack={() => setOpen(false)} /> : <button onClick={() => setOpen(true)}>Volver al estudio</button>}</div></div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
