import { EventEmitter } from 'node:events';
import type { CalendarService } from '../calendar-service';
import type { DriveService } from '../drive-service';
import type { GmailService } from '../gmail-service';
import type { WhatsAppService } from '../whatsapp-service';
import { MeetingDetectionStore } from './meeting-detection-store';
import { fetchRecentTranscriptFiles } from './passive-detection-fetchers';
import { processPassiveTranscriptFile } from './passive-detection-processor';
import { scanCalendarSignals } from './passive-detection-scan-calendar';
import { scanDriveTranscripts } from './passive-detection-scan-drive';
import { scanGmailSignals } from './passive-detection-scan-gmail';
import type { PassiveTranscriptInput } from './passive-detection-types';
import type { MeetingWorkflowService } from './meeting-workflow-service';
import { notifyMeetingDetectionUser } from './passive-detection-notifier';
import { resolvePassiveDetectionUserContext } from './passive-detection-user-context';

export class MeetingPassiveDetectionService extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private scanInFlight = false;
  private whatsappService: WhatsAppService | null = null;

  constructor(
    private readonly calendarService: CalendarService,
    private readonly gmailService: GmailService,
    private readonly driveService: DriveService,
    private readonly workflowService: MeetingWorkflowService,
    private readonly detectionStore: MeetingDetectionStore,
  ) {
    super();
  }

  async init(): Promise<void> {
    this.detectionStore.init();
  }

  setWhatsAppService(service: WhatsAppService): void {
    this.whatsappService = service;
  }

  startPolling(intervalMs: number = 20 * 60 * 1000): void {
    if (this.intervalId) clearInterval(this.intervalId);
    const tick = async () => this.runScanNow();
    tick().catch((error) => console.error('[MeetingPassiveDetection] Initial scan error:', error));
    this.intervalId = setInterval(() => {
      tick().catch((error) => console.error('[MeetingPassiveDetection] Poll error:', error));
    }, intervalMs);
    console.log(`[MeetingPassiveDetection] Polling started every ${intervalMs / 60000} minutes`);
  }

  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[MeetingPassiveDetection] Polling stopped');
  }

  async runScanNow(): Promise<void> {
    if (this.scanInFlight) {
      console.log('[MeetingPassiveDetection] Scan skipped because another scan is still running');
      return;
    }

    this.scanInFlight = true;
    try {
      const user = await resolvePassiveDetectionUserContext(this.calendarService);
      if (!user) {
        console.log('[MeetingPassiveDetection] No Google user context available for meeting detection');
        return;
      }

      const recentTranscriptFiles = await fetchRecentTranscriptFiles(this.driveService);
      const processTranscript = (input: PassiveTranscriptInput) => this.processTranscriptFile(input);
      await scanCalendarSignals({ user, recentTranscriptFiles, calendarService: this.calendarService, detectionStore: this.detectionStore, processTranscript });
      await scanGmailSignals({ user, recentTranscriptFiles, gmailService: this.gmailService, detectionStore: this.detectionStore, processTranscript });
      await scanDriveTranscripts({ user, recentTranscriptFiles, detectionStore: this.detectionStore, processTranscript });
    } finally {
      this.scanInFlight = false;
    }
  }

  private async processTranscriptFile(input: PassiveTranscriptInput): Promise<void> {
    await processPassiveTranscriptFile({
      detectionStore: this.detectionStore,
      input,
      notifyUser: ({ detail, file, user }) => notifyMeetingDetectionUser({
        detail,
        file,
        user,
        whatsappService: this.whatsappService,
        workflowService: this.workflowService,
        emitDetected: (payload) => this.emit('meeting-detected', payload),
      }),
      workflowService: this.workflowService,
    });
  }
}
