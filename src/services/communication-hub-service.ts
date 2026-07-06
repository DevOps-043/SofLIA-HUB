export type ChannelProvider = 'whatsapp' | 'telegram';
export type ChannelScope = 'personal' | 'organization';
export type ChannelRole = 'owner' | 'admin' | 'member';

export interface ChannelActorInput {
  userId?: string | null;
  organizationId?: string | null;
}

export interface CommunicationHubResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    communicationHub?: {
      getCapabilities: (actor?: ChannelActorInput) => Promise<CommunicationHubResult>;
      getPersonalStatus: (actor?: ChannelActorInput) => Promise<CommunicationHubResult>;
      updatePersonalPreferences: (actor: ChannelActorInput, updates: Record<string, unknown>) => Promise<CommunicationHubResult>;
      getOrgStatus: (actor?: ChannelActorInput) => Promise<CommunicationHubResult>;
      updateOrgConnection: (actor: ChannelActorInput, update: Record<string, unknown>) => Promise<CommunicationHubResult>;
      updatePolicy: (actor: ChannelActorInput, updates: Record<string, unknown>) => Promise<CommunicationHubResult>;
      listIdentities: (actor?: ChannelActorInput) => Promise<CommunicationHubResult>;
      listHistory: (actor?: ChannelActorInput) => Promise<CommunicationHubResult>;
      sendMessage: (request: Record<string, unknown>) => Promise<CommunicationHubResult>;
      scheduleMessage: (request: Record<string, unknown>) => Promise<CommunicationHubResult>;
    };
  }
}

export function isCommunicationHubAvailable(): boolean {
  return Boolean(window.communicationHub);
}

export function getCommunicationHub() {
  if (!window.communicationHub) {
    throw new Error('Communication Hub no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.communicationHub;
}
