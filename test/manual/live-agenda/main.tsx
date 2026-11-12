import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LearningSessions } from '../../../src/components/learning-live/LearningSessions';
import type {
  LiveCatalog,
  LiveCatalogSession,
  LiveCatalogRequest,
} from '../../../src/shared/learning-live-catalog';
import '../../../src/index.css';

// Identidades y sesiones ficticias, exclusivas de esta prueba local sin credenciales.
type Role = NonNullable<LiveCatalog['capabilities']>['role'];
let role: Role = 'organization_admin';
let scenario = 'sessions';
const user = '00000000-0000-4000-8000-000000000013';
const now = Date.now();
const session = (
  index: number,
  title: string,
  course: string,
  offset: number,
  status: LiveCatalogSession['status'] = 'scheduled',
): LiveCatalogSession => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title,
  description:
    index === 1
      ? 'Un taller práctico para convertir ideas en soluciones que puedas aplicar en tu trabajo.'
      : '',
  starts_at: new Date(now + offset).toISOString(),
  duration_minutes: 60,
  status,
  session_type: 'meeting',
  course_title: course,
  instructor_name: index % 2 ? 'Mariana López' : 'Daniel Ruiz',
});
const upcoming = [
  session(
    1,
    'De una idea a un flujo de trabajo',
    'Inteligencia artificial aplicada',
    -600_000,
    'live',
  ),
  session(2, 'Diseñar mejores conversaciones con IA', 'Productividad y creatividad', 86_400_000),
  session(
    3,
    'Del primer borrador al resultado final',
    'Inteligencia artificial aplicada',
    172_800_000,
  ),
  session(4, 'Automatiza lo que se repite', 'Herramientas para tu trabajo', 259_200_000),
];
const past = [
  session(
    5,
    'Un punto de partida para tu proyecto',
    'Inteligencia artificial aplicada',
    -172_800_000,
    'ended',
  ),
  session(
    6,
    'Exploración de nuevas herramientas',
    'Productividad y creatividad',
    -259_200_000,
    'cancelled',
  ),
  session(7, 'Una sesión sin cierre registrado', 'Herramientas para tu trabajo', -345_600_000),
];
window.learningLive = {
  catalog: async (request: LiveCatalogRequest) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (scenario === 'error')
      return {
        success: false,
        code: 'unavailable',
        error: 'No se pudo conectar con Learning. Intenta de nuevo.',
      };
    const manages = role !== 'student';
    if (request.period === 'past' && !manages)
      return { success: false, code: 'access_denied', error: 'Acceso denegado.' };
    const sessions = scenario === 'empty' ? [] : request.period === 'past' ? past : upcoming;
    return {
      success: true,
      catalog: {
        version: 1,
        user_id: user,
        can_teach: manages,
        total: sessions.length,
        sessions,
        capabilities: { version: 1, role, can_manage: manages, can_view_history: manages },
        ...(manages ? { management_url: 'https://learning.test/acme/instructor' } : {}),
      },
    };
  },
  workspace: async () => ({ success: false, error: 'Solo agenda de prueba.' }),
  open: async () => ({ success: false, error: 'No se conectan medios en esta prueba.' }),
  getPending: async () => null,
  onRequested: () => () => {},
};

export function Preview() {
  const [selectedRole, setRole] = useState<Role>(role);
  const [content, setContent] = useState(scenario);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState('');
  document.documentElement.classList.toggle('dark', dark);
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-background-val)',
        color: 'var(--color-text-main)',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '10px 18px',
          borderBottom: '1px solid var(--color-border-val)',
          fontSize: 11,
          flexWrap: 'wrap',
        }}
      >
        <span>Vista de prueba · Datos ficticios</span>
        <label>
          Perfil{' '}
          <select
            aria-label="Perfil de ejemplo"
            value={selectedRole}
            style={{ background: 'var(--color-card-val)' }}
            onChange={(event) => {
              role = event.target.value as Role;
              setRole(role);
              setNotice('');
            }}
          >
            <option value="platform_admin">Administrador de plataforma</option>
            <option value="organization_admin">Administrador de organización</option>
            <option value="instructor">Instructor</option>
            <option value="student">Usuario</option>
          </select>
        </label>
        <label>
          Estado{' '}
          <select
            aria-label="Estado de ejemplo"
            value={content}
            style={{ background: 'var(--color-card-val)' }}
            onChange={(event) => {
              scenario = event.target.value;
              setContent(scenario);
            }}
          >
            <option value="sessions">Con sesiones</option>
            <option value="empty">Vacío</option>
            <option value="error">Error</option>
          </select>
        </label>
        <button onClick={() => setDark(!dark)}>{dark ? 'Modo claro' : 'Modo oscuro'}</button>
      </header>
      {notice && (
        <p role="status" style={{ padding: '8px 18px', fontSize: 11 }}>
          {notice}
        </p>
      )}
      <div style={{ minHeight: 0, flex: 1, display: 'flex' }}>
        <LearningSessions
          key={`${selectedRole}:${content}`}
          organizationSlug="acme"
          organizationName="Acme Academy"
          onSelect={() => setNotice('Entrada al aula solicitada; sin conectar medios.')}
          onClose={() => setNotice('Cerrar agenda solicitado.')}
          onOpenManagement={async (url) => {
            setNotice(`Destino de gestión verificado: ${url}`);
          }}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
