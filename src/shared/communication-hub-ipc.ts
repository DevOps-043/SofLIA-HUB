export const COMMUNICATION_IPC_LIMITS = Object.freeze({ inputBytes: 128 * 1024, outputBytes: 256 * 1024, messageChars: 16384, listItems: 100, activeOperations: 8, requestMs: 180000, pollMinMs: 2000, pollMaxMs: 60000, dailyLimit: 10000 });
export interface CommunicationHubActor { userId?: string | null; organizationId?: string | null }
export type CommunicationProvider = 'whatsapp' | 'telegram';
export type CommunicationScope = 'personal' | 'organization';
export interface CommunicationMessage {
  provider: CommunicationProvider; scope: CommunicationScope; recipient: string; text: string;
  actor?: CommunicationHubActor; metadata?: Record<string, unknown>;
}
export interface CommunicationScheduledMessage extends CommunicationMessage { scheduledAt: string }
export interface CommunicationHubResult<T = unknown> { success: boolean; error?: string; data?: T; [key: string]: unknown }
export interface CommunicationHubApi {
  getCapabilities(actor?: CommunicationHubActor): Promise<CommunicationHubResult>;
  getPersonalStatus(actor?: CommunicationHubActor): Promise<CommunicationHubResult>;
  getOrgStatus(actor?: CommunicationHubActor): Promise<CommunicationHubResult>;
  listIdentities(actor?: CommunicationHubActor): Promise<CommunicationHubResult>;
  listHistory(actor?: CommunicationHubActor): Promise<CommunicationHubResult>;
  updatePersonalPreferences(actor: CommunicationHubActor, updates: Record<string, unknown>): Promise<CommunicationHubResult>;
  updateOrgConnection(actor: CommunicationHubActor, updates: Record<string, unknown>): Promise<CommunicationHubResult>;
  updatePolicy(actor: CommunicationHubActor, updates: Record<string, unknown>): Promise<CommunicationHubResult>;
  sendMessage(request: CommunicationMessage): Promise<CommunicationHubResult>;
  scheduleMessage(request: CommunicationScheduledMessage): Promise<CommunicationHubResult>;
}
