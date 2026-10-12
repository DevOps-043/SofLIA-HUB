import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LearningSessions } from '../../../src/components/learning-live/LearningSessions';
import { LearningWorkspace } from '../../../src/components/learning-live/LearningWorkspace';
import { InstructorStudio } from '../../../src/components/learning-live/instructor/InstructorStudio';
import { studioExamples } from './studio-examples';
import { ToolsDropdownButton } from '../../../src/adapters/desktop_ui/chat-ui/header/ToolsDropdownButton';
import type { LearningLiveSessionReference } from '../../../src/shared/learning-live-session';
import '../../../src/index.css';

// Datos de ejemplo exclusivos de esta prueba visual; no se usan en la aplicación.
const user = '00000000-0000-4000-8000-000000000013';
const sessions = [
  { id: '00000000-0000-4000-8000-000000000031', title: 'De una idea a un flujo de trabajo', course_title: 'IA aplicada al trabajo', instructor_name: 'Mariana López', description: 'Transforma una tarea de tu día a día en un flujo de trabajo con inteligencia artificial. Vamos a construirlo juntos.', starts_at: '2026-10-11T18:00:00Z', duration_minutes: 60, status: 'live' as const, session_type: 'meeting' as const },
  { id: '00000000-0000-4000-8000-000000000032', title: 'Prompts que hacen la diferencia', course_title: 'IA aplicada al trabajo', instructor_name: 'Mariana López', description: '', starts_at: '2026-10-13T18:00:00Z', duration_minutes: 45, status: 'scheduled' as const, session_type: 'meeting' as const },
  { id: '00000000-0000-4000-8000-000000000033', title: 'Del primer borrador al resultado final', course_title: 'Productividad y creatividad', instructor_name: 'Daniel Ruiz', description: '', starts_at: '2026-10-15T20:00:00Z', duration_minutes: 60, status: 'scheduled' as const, session_type: 'webinar' as const },
];
window.learningLive = {
  catalog: async () => ({ success: true, catalog: { version: 1, user_id: user, can_teach: true, total: sessions.length, sessions } }),
  workspace: async () => { throw new Error('El lienzo vacío no consulta colaboración.'); },
  open: async () => { throw new Error('El lienzo vacío no abre medios.'); },
  getPending: async () => null, onRequested: () => () => {},
};

export function Preview() {
  const [ref, setRef] = useState<LearningLiveSessionReference | null>({ organization_slug: 'acme', session_id: sessions[0].id });
  const [dark, setDark] = useState(true);
  const [role, setRole] = useState<'instructor' | 'participant'>('instructor');
  function selectSession(reference: LearningLiveSessionReference) {
    setRef(reference);
  }
  document.documentElement.classList.toggle('dark', dark);
  return <div className="flex h-screen flex-col bg-background text-primary"><header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-[10px]"><span>Vista previa · Datos de ejemplo</span><div className="flex items-center gap-3"><label><span className="sr-only">Vista de ejemplo</span><select className="bg-background" value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="instructor">Instructor</option><option value="participant">Participante</option></select></label><button onClick={() => setDark(!dark)}>{dark ? 'Modo claro' : 'Modo oscuro'}</button><ToolsDropdownButton onOpenBrowser={() => {}} onOpenMeetings={() => {}} onOpenLiveSessions={() => setRef(null)} /></div></header><div className="flex min-h-0 flex-1">{ref ? role === 'instructor' ? <InstructorStudio title={sessions.find((session) => session.id === ref.session_id)?.title} instructorName="Mariana López" examples={studioExamples} onBack={() => setRef(null)} onClose={() => setRef(null)} /> : <LearningWorkspace onClose={() => setRef(null)} onBackToSessions={() => setRef(null)} /> : <LearningSessions organizationSlug="acme" organizationName="Acme Academy" onSelect={selectSession} onClose={() => {}} />}</div></div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
