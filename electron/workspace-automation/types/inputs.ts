import type { CalendarService } from '../../calendar-service';
import type { DesktopAgentService } from '../../desktop-agent-service';
import type { DriveService } from '../../drive-service';
import type { GChatService } from '../../gchat-service';
import type { GmailService } from '../../gmail-service';
import type { WorkflowTemplateId } from './core';

export interface WorkflowDependencies {
  gmailService: GmailService;
  calendarService: CalendarService;
  gchatService: GChatService;
  driveService: DriveService;
  desktopAgentService: DesktopAgentService;
}

export interface ExecuteTemplateInput {
  templateId: WorkflowTemplateId;
  input?: Record<string, any>;
  requestedBy?: string | null;
}

export interface CreateCustomTemplateInput {
  name?: string | null;
  objective: string;
  requestedBy?: string | null;
}

export interface DriveFolderDefinition {
  name: string;
  children?: DriveFolderDefinition[];
}
