import { useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../../src/contexts/auth/context';
import { UnifiedSettingsModal } from '../../../src/components/UnifiedSettingsModal';
import { UserMenu } from '../../../src/components/sidebar/UserMenu';
import type { SofiaContext } from '../../../src/services/sofia-auth';
import '../../../src/index.css';
const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
const org = { id: '10000000-0000-4000-8000-000000000001', name: 'Empresa de prueba', slug: 'prueba', is_active: true, created_at: '', logo_url: 'https://assets.example.test/logo.svg' };
const membership = { id: 'm', user_id: 'sofia-user', organization_id: org.id, role: params.get('role') === 'member' ? 'member' as const : 'admin' as const, status: 'active' as const };
const initial: SofiaContext = { currentOrganization: org, currentTeam: null, organizations: [org], teams: [], memberships: [membership], user: { id: 'sofia-user', username: 'ana', email: 'ana@example.test', full_name: 'Ana', organizations: [org], teams: [], memberships: [membership] } };
export function Fixture() {
  const defaults = useContext(AuthContext);
  const [context, setContext] = useState(initial);
  const [open, setOpen] = useState(true);
  return <AuthContext.Provider value={{ ...defaults, sofiaContext: context, updateOrganizationProfile: updated => setContext(previous => ({ ...previous, currentOrganization: updated, organizations: [updated] })) }}>
    <main className="min-h-screen bg-background p-8 text-primary">
      <div className="flex h-[650px] w-[280px] flex-col bg-sidebar"><div className="flex-1 p-4 text-sm">Conversaciones</div>
        <UserMenu isOpen displayName="Ana" initials="A" userEmail={undefined} avatarUrl={undefined} orgName={context.currentOrganization?.name} orgLogoUrl={context.currentOrganization?.logo_url} organizations={context.organizations} currentOrgId={org.id} theme="dark" onSetTheme={() => {}} onOpenSettings={() => setOpen(true)} onSignOut={() => {}} />
      </div>
      <UnifiedSettingsModal isOpen={open} onClose={() => setOpen(false)} userId="lia-user" userSettings={null} onSaveSettings={() => {}} sofiaContext={context} apiKey="" initialTab="organization" />
    </main>
  </AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
