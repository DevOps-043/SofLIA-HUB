export type SettingsTab = 'ai' | 'memory' | 'whatsapp' | 'connections' | 'team' | 'productivity' | 'meetings' | 'agents' | 'updates';

export function getSettingsTabs(sofiaContext: any): Array<{ id: SettingsTab; label: string; icon: JSX.Element; hidden?: boolean }> {
  return [
    {
      id: 'ai',
      label: 'Personalización',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
      id: 'memory',
      label: 'Memoria',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5a5.5 5.5 0 00-5.5 5.5c0 1.7.8 3.2 2 4.2V19h7v-2.8c1.2-1 2-2.5 2-4.2A5.5 5.5 0 0012 6.5z" /><path strokeLinecap="round" d="M9.5 19h5" /></svg>,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.5h5m-8.5 8 1.4-3.8A8 8 0 1112 20a8.2 8.2 0 01-3.7-.88L4 19.75z" /></svg>,
    },
    {
      id: 'connections',
      label: 'Conexiones',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.757 8.188" /></svg>,
    },
    {
      id: 'team',
      label: 'Miembros',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
      hidden: !sofiaContext?.currentOrganization,
    },
    {
      id: 'productivity',
      label: 'Productividad',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      id: 'agents',
      label: 'Flujos de Trabajo',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.75 8.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-4.5 9h5.5v1.5h-5.5zm1-10V5.25h3.5v2.5m0 6.5v2.5h-3.5v-2.5" /></svg>,
    },
    {
      id: 'updates',
      label: 'Actualización',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    },
  ];
}
