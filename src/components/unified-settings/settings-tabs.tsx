import { HubGlyph } from '../ui/HubGlyph';
import { canManageOrganization } from '../../services/org/settings-contract';
export type SettingsMasterTab = 'identity' | 'appearance' | 'integrations' | 'organization' | 'team' | 'system';

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
  | 'passive-skills'
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
    case 'organization':
      return 'organization';
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
    case 'passive-skills':
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
          label: 'Personalidad y privacidad',
          description: 'Identidad, sintonía, instrucciones, memoria y gobernanza',
          icon: (
            <HubGlyph name="identity" size={20} />
          ),
        },
        {
          id: 'appearance',
          label: 'Apariencia y voz',
          description: 'Diseño de interfaz y entrada de voz',
          icon: (
            <HubGlyph name="appearance" size={20} />
          ),
        },
      ],
    },
    {
      title: 'CAPACIDADES',
      tabs: [
        {
          id: 'integrations',
          label: 'Integraciones y skills',
          description: 'WhatsApp Agent, conexiones API y skills activas y pasivas por canal',
          icon: (
            <HubGlyph name="connection" size={20} />
          ),
        },
      ],
    },
    {
      title: 'ORGANIZACIÓN',
      tabs: [
        {
          id: 'organization',
          label: 'Organización',
          description: 'Datos generales, logo, icono y colores de la organización',
          icon: <HubGlyph name="settings" size={20} />,
          hidden: !canManageOrganization(sofiaContext),
        },
        {
          id: 'team',
          label: 'Equipo y productividad',
          description: 'Gestión de miembros y dashboard de rendimiento',
          icon: (
            <HubGlyph name="teams" size={20} />
          ),
          hidden: !sofiaContext?.currentOrganization,
        },
        {
          id: 'system',
          label: 'Sistema y actualizaciones',
          description: 'Diagnóstico técnico del cliente y actualizaciones de versión',
          icon: (
            <HubGlyph name="refresh" size={20} />
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
