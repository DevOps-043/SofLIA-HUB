import { getAllWhatsAppSessions } from '../iris-data-main';
import type { WhatsAppService } from '../whatsapp-service';
import { buildMeetingRunIntroMessage, MeetingWorkflowManager } from '../whatsapp-workflow-meetings';
import type { DriveFile } from '../drive-service';
import type { MeetingRunDetail } from './meeting-types';
import type { MeetingWorkflowService } from './meeting-workflow-service';

export interface PassiveDetectionUserContext {
  ownerUserId: string;
  email: string;
  displayName: string;
}

interface NotifyMeetingDetectionOptions {
  detail: MeetingRunDetail;
  emitDetected: (payload: { runId: string; ownerUserId: string; meetingTitle: string | null; sourceFileName: string | null }) => void;
  file?: DriveFile;
  user: PassiveDetectionUserContext;
  whatsappService: WhatsAppService | null;
  workflowService: MeetingWorkflowService;
}

export async function notifyMeetingDetectionUser(options: NotifyMeetingDetectionOptions): Promise<void> {
  const { detail, emitDetected, file, user, whatsappService, workflowService } = options;
  const sessions = getAllWhatsAppSessions().filter((session) => session.userId === user.ownerUserId);
  const whatsappConnected = whatsappService?.getStatus().connected;

  if (whatsappService && whatsappConnected && sessions.length > 0) {
    const session = sessions[0];
    const cleanPhoneNumber = session.phoneNumber.replace(/\D/g, '');
    const jid = `${cleanPhoneNumber}@s.whatsapp.net`;

    if (!MeetingWorkflowManager.isActive(cleanPhoneNumber)) {
      await MeetingWorkflowManager.startWorkflowForExistingRun(
        cleanPhoneNumber,
        jid,
        cleanPhoneNumber,
        whatsappService,
        workflowService,
        detail.run.id,
        buildMeetingRunIntroMessage(detail, { fallbackTitle: file?.name || null }),
      );
    } else {
      await whatsappService.sendText(jid, buildMeetingRunIntroMessage(detail, { fallbackTitle: file?.name || null, busy: true }));
    }
    return;
  }

  emitDetected({
    runId: detail.run.id,
    ownerUserId: user.ownerUserId,
    meetingTitle: detail.run.meeting_title,
    sourceFileName: file?.name || null,
  });
}
