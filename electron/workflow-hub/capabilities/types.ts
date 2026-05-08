import type { CalendarService } from '../../calendar-service';
import type { ChatSpace, GChatService } from '../../gchat-service';
import type { WorkspaceCapabilityStatus } from '../types';

export type CapabilitiesDeps = {
  calendarService: CalendarService;
  gchatService: GChatService;
};

export type GchatCapabilityResult = {
  capability: WorkspaceCapabilityStatus;
  gchatSpaces: ChatSpace[];
};

export type WorkspaceCapabilitiesSnapshot = {
  capabilities: WorkspaceCapabilityStatus[];
  gchatSpaces: ChatSpace[];
};
