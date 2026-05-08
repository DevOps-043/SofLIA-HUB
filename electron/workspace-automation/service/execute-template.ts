import type { WorkspaceAutomationService } from '../../workspace-automation-service.ts';
import { executeCalendarDailyBrief } from '../handlers/calendar-daily-brief';
import { executeCalendarMeetingPrep } from '../handlers/calendar-meeting-prep';
import { executeDesktopAction } from '../handlers/desktop-action';
import { executeDriveProjectWorkspace } from '../handlers/drive-project-workspace';
import { executeGChatExecutiveUpdate } from '../handlers/gchat-executive-update';
import { executeGmailFollowupDraft } from '../handlers/gmail-followup-draft';
import { executeGmailTriage } from '../handlers/gmail-triage';
import type { ExecuteTemplateInput, WorkflowRunRecord } from '../types';

export async function executeTemplate(this: WorkspaceAutomationService, input: ExecuteTemplateInput): Promise<WorkflowRunRecord> {
    const handlerContext = this.getTemplateHandlerContext();
    switch (input.templateId) {
      case 'gmail_triage':
        return executeGmailTriage(input, handlerContext);
      case 'calendar_daily_brief':
        return executeCalendarDailyBrief(input, handlerContext);
      case 'gmail_followup_draft':
        return executeGmailFollowupDraft(input, handlerContext);
      case 'calendar_meeting_prep':
        return executeCalendarMeetingPrep(input, handlerContext);
      case 'drive_project_workspace':
        return executeDriveProjectWorkspace(input, handlerContext);
      case 'gchat_executive_update':
        return executeGChatExecutiveUpdate(input, handlerContext);
      case 'desktop_action':
        return executeDesktopAction(input, handlerContext);
      default:
        return this.executeCustomTemplate(input);
    }
  }
