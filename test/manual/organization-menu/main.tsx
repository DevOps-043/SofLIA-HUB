import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UserMenu } from '../../../src/components/sidebar/UserMenu';
import type { SofiaOrganization } from '../../../src/lib/sofia-client';
import '../../../src/index.css';

// Marcas sintéticas para probar proporciones sin datos ni credenciales de empresas.
const svg = (width: number, height: number, content: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`)}`;
const organizations: SofiaOrganization[] = [
  { id: 'alta', name: 'Marca vertical', slug: 'alta', logo_url: svg(48, 120, '<path d="M24 2 46 38 34 38 34 116 14 116 14 38 2 38Z" fill="#00c9a7"/>'), is_active: true, created_at: '' },
  { id: 'ancha', name: 'Marca horizontal', slug: 'ancha', logo_url: svg(240, 48, '<path d="M24 2 46 24 24 46 2 24Z" fill="#00c9a7"/><text x="56" y="35" fill="#00c9a7" font-family="Arial" font-size="34" font-weight="700">DEMO</text>'), is_active: true, created_at: '' },
  { id: 'cuadrada', name: 'Marca cuadrada', slug: 'cuadrada', logo_url: svg(48, 48, '<path d="M24 2 46 24 24 46 2 24Z" fill="#00c9a7"/><circle cx="24" cy="24" r="9" fill="#0a2540"/>'), is_active: true, created_at: '' },
  { id: 'rota', name: 'Logo no disponible', slug: 'rota', logo_url: '/imagen-inexistente.png', brand_favicon_url: '/favicon-inexistente.png', is_active: true, created_at: '' },
];

export function Preview() {
  const [current, setCurrent] = useState(organizations[0]);
  const dark = new URLSearchParams(location.search).get('theme') !== 'light';
  document.documentElement.classList.toggle('dark', dark);
  return (
    <main className="min-h-screen bg-background p-8 text-primary">
      <h1 className="text-xl font-semibold">Identidad de organización</h1>
      <p className="mt-2 text-sm">Marcas sintéticas: vertical, horizontal, cuadrada y carga fallida.</p>
      <select aria-label="Marca de prueba" className="mt-4 bg-background p-2" value={current.id} onChange={event => setCurrent(organizations.find(org => org.id === event.target.value)!)}>
        {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
      </select>
      <div className="mt-8 flex items-start gap-8">
        {(['expandida', 'compacta', 'inferior'] as const).map(mode => (
          <section key={mode}>
            <h2 className="mb-3 text-sm">Barra {mode}</h2>
            <div data-preview={mode} className="flex h-[430px] flex-col justify-end bg-sidebar" style={{ width: mode === 'compacta' ? 60 : 280 }}>
              {mode !== 'compacta' && <div className="flex-1 space-y-3 p-4 text-sm text-primary"><p className="text-xs text-secondary">Conversaciones</p><p>Plan de trabajo</p><p>Ideas para el proyecto</p></div>}
              <UserMenu isOpen={mode !== 'compacta'} position={mode === 'inferior' ? 'bottom' : 'left'} displayName="Persona de prueba" initials="PP" userEmail={undefined} avatarUrl={undefined}
                orgName={current.name} orgLogoUrl={current.logo_url} orgFaviconUrl={current.brand_favicon_url} currentOrgId={current.id} organizations={organizations}
                onSelectOrganization={id => setCurrent(organizations.find(org => org.id === id)!)} theme={dark ? 'dark' : 'light'}
                onSetTheme={() => {}} onOpenSettings={() => {}} onSignOut={() => {}} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
