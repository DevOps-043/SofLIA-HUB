export type SettingsMasterTab = 'identity' | 'appearance' | 'integrations' | 'team' | 'system';

export type SettingsTab =
  | SettingsMasterTab
  | 'ai'
  | 'skills'
  | 'memory'
  | 'whatsapp'
  | 'voice'
  | 'privacy'
  | 'connections'
  | 'productivity'
  | 'meetings'
  | 'agents'
  | 'updates';

import type { SofiaContext } from '../../services/sofia-auth';

export interface SettingsCategoryGroup {
  title: string;
  tabs: Array<{
    id: SettingsMasterTab;
    label: string;
    description: string;
    icon: React.JSX.Element;
    hidden?: boolean;
  }>;
}

export function resolveMasterTab(tab: SettingsTab): SettingsMasterTab {
  switch (tab) {
    case 'ai':
    case 'memory':
    case 'privacy':
    case 'identity':
      return 'identity';
    case 'voice':
    case 'appearance':
      return 'appearance';
    case 'skills':
    case 'whatsapp':
    case 'connections':
    case 'meetings':
    case 'agents':
    case 'integrations':
      return 'integrations';
    case 'productivity':
    case 'team':
      return 'team';
    case 'updates':
    case 'system':
    default:
      return 'system';
  }
}

export function getSettingsCategoryGroups(sofiaContext: SofiaContext | null): SettingsCategoryGroup[] {
  return [
    {
      title: 'PERSONALIZACIÓN',
      tabs: [
        {
          id: 'identity',
          label: 'Personalidad & Privacidad',
          description: 'Identidad, sintonía, instrucciones, memoria y gobernanza',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          ),
        },
        {
          id: 'appearance',
          label: 'Apariencia & Voz',
          description: 'Diseño de interfaz, entrada de voz y agente proactivo',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'CAPACIDADES',
      tabs: [
        {
          id: 'integrations',
          label: 'Integraciones & Skills',
          description: 'WhatsApp Agent, API conexiones, skills y flujos de trabajo',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.757 8.188" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'ORGANIZACIÓN',
      tabs: [
        {
          id: 'team',
          label: 'Equipo & Productividad',
          description: 'Gestión de miembros y dashboard de rendimiento',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          ),
          hidden: !sofiaContext?.currentOrganization,
        },
        {
          id: 'system',
          label: 'Sistema & Actualización',
          description: 'Diagnóstico técnico del cliente y actualizaciones de versión',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          ),
        },
      ],
    },
  ];
}

export function getSettingsTabs(sofiaContext: SofiaContext | null): Array<{ id: SettingsTab; label: string; icon: React.JSX.Element; hidden?: boolean }> {
  const groups = getSettingsCategoryGroups(sofiaContext);
  return groups.flatMap((group) => group.tabs);
}
