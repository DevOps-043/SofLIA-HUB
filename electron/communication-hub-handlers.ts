import type { BrowserWindow } from 'electron';
import type { CommunicationHubService } from './communication-hub/service';
import { communicationGateway } from './communication-hub/ipc-gateway';
import { communicationActor, communicationConnection, communicationMessage, communicationPolicy, communicationPreferences } from './communication-hub/ipc-contract';
import type { ChannelScheduleRequest } from './communication-hub/types';

export function registerCommunicationHubHandlers(service: CommunicationHubService, windows: () => (BrowserWindow | null)[]): void {
  const { register } = communicationGateway(service, windows);
  register('channels:get-capabilities', 1, (args, actor) => service.getCapabilities(communicationActor(args[0], actor)));
  register('channels:get-personal-status', 1, (args, actor) => service.getPersonalStatus(communicationActor(args[0], actor)));
  register('channels:get-org-status', 1, (args, actor) => service.getOrgStatus(communicationActor(args[0], actor)));
  register('channels:list-identities', 1, (args, actor) => service.listIdentities(communicationActor(args[0], actor)));
  register('channels:list-history', 1, (args, actor) => service.listHistory(communicationActor(args[0], actor)));
  register('channels:update-personal-preferences', 2, (args, actor) => service.updatePersonalPreferences(communicationActor(args[0], actor), communicationPreferences(args[1])));
  register('channels:update-org-connection', 2, (args, actor) => service.updateOrgConnection(communicationActor(args[0], actor), communicationConnection(args[1])));
  register('channels:update-policy', 2, (args, actor) => service.updatePolicy(communicationActor(args[0], actor), communicationPolicy(args[1])));
  register('channels:send-message', 1, (args, actor) => service.sendMessage(communicationMessage(args[0], actor, false)));
  register('channels:schedule-message', 1, (args, actor) => service.scheduleMessage(communicationMessage(args[0], actor, true) as ChannelScheduleRequest));
}
