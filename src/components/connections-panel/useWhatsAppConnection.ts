import type { CommunicationHubActor } from '../../shared/communication-hub-ipc';
import { useWhatsAppSetupState } from '../whatsapp-setup/useWhatsAppSetupState';
import type { WhatsAppConnectionState } from './types';

/** Adaptador del panel compacto: comparte carga, cancelación y suscripciones. */
export function useWhatsAppConnection(apiKey?: string, actor?: CommunicationHubActor): WhatsAppConnectionState {
  const setup = useWhatsAppSetupState({ isOpen: true, apiKey, actor, historyEnabled: false });
  return { status: setup.status, connecting: setup.connecting, connect: setup.handleConnect, disconnect: setup.handleDisconnect };
}
