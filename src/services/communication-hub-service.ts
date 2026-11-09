import type { CommunicationHubApi } from '../shared/communication-hub-ipc';
export type { CommunicationProvider as ChannelProvider, CommunicationScope as ChannelScope, CommunicationHubActor as ChannelActorInput, CommunicationHubResult } from '../shared/communication-hub-ipc';
export type ChannelRole = 'owner' | 'admin' | 'member';
declare global { interface Window { communicationHub?: CommunicationHubApi } }

export function isCommunicationHubAvailable(): boolean {
  return Boolean(window.communicationHub);
}

export function getCommunicationHub() {
  if (!window.communicationHub) {
    throw new Error('Communication Hub no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.communicationHub;
}
