import { EventEmitter } from 'node:events';
import type { CalendarService } from '../calendar-service';
import type { DriveFile, DriveService } from '../drive-service';
import type { GmailService } from '../gmail-service';
import { getAllWhatsAppSessions, getSofiaUserByEmail } from '../iris-data-main';
import type { WhatsAppService } from '../whatsapp-service';
import { MeetingWorkflowManager } from '../whatsapp-workflow-meetings';
import { MeetingDetectionStore } from './meeting-detection-store';
import type { MeetingRunDetail } from './meeting-types';
import type { MeetingWorkflowService } from './meeting-workflow-service';

interface PassiveDetectionUserContext {
  ownerUserId: string;
  email: string;
  displayName: string;
}

interface CalendarMeetingSignal {
  id: string;
  title: string;
  start: string;
  end: string;
  meetUrl?: string | null;
  meetingCode?: string | null;
}

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
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const tick = async () => {
      await this.runScanNow();
    };

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
      const user = await this.resolveUserContext();
      if (!user) {
        console.log('[MeetingPassiveDetection] No Google user context available for meeting detection');
        return;
      }

      const recentTranscriptFiles = await this.fetchRecentTranscriptFiles();
      await this.scanCalendarSignals(user, recentTranscriptFiles);
      await this.scanGmailSignals(user, recentTranscriptFiles);
      await this.scanDriveTranscripts(user, recentTranscriptFiles);
    } finally {
      this.scanInFlight = false;
    }
  }

  private async resolveUserContext(): Promise<PassiveDetectionUserContext | null> {
    const googleConnection = this.calendarService
      .getConnections()
      .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);

    if (!googleConnection?.email) {
      return null;
    }

    const sofiaUser = googleConnection.userId
      ? { id: googleConnection.userId, email: googleConnection.email, username: null, display_name: googleConnection.email }
      : await getSofiaUserByEmail(googleConnection.email);

    if (!sofiaUser?.id) {
      console.warn(`[MeetingPassiveDetection] Could not resolve SOFIA user for Google email ${googleConnection.email}`);
      return null;
    }

    return {
      ownerUserId: sofiaUser.id,
      email: googleConnection.email,
      displayName: sofiaUser.display_name || sofiaUser.username || googleConnection.email,
    };
  }

  private async scanCalendarSignals(user: PassiveDetectionUserContext, recentTranscriptFiles: DriveFile[]): Promise<void> {
    const events = await this.fetchRecentCalendarMeetings();
    for (const event of events) {
      const detectionKey = `calendar:${event.id}`;
      const meetingCode = event.meetingCode || this.extractMeetingCode(`${event.title} ${event.meetUrl || ''}`);

      await this.detectionStore.upsertCandidate({
        ownerUserId: user.ownerUserId,
        detectionKey,
        sourceType: 'calendar',
        meetingTitle: event.title,
        meetingCode,
        calendarEventId: event.id,
        status: 'transcript_pending',
        metadata: {
          start: event.start,
          end: event.end,
          meet_url: event.meetUrl || null,
          detected_via: 'calendar',
        },
      });

      const transcriptFile = this.matchTranscriptFile(recentTranscriptFiles, meetingCode, event.title);
      if (transcriptFile) {
        await this.processTranscriptFile({
          user,
          detectionKey,
          fileId: transcriptFile.id,
          meetingTitle: event.title,
          sourceRef: event.meetUrl || transcriptFile.webViewLink || `calendar:${event.id}`,
          file: transcriptFile,
        });
      }
    }
  }

  private async scanGmailSignals(user: PassiveDetectionUserContext, recentTranscriptFiles: DriveFile[]): Promise<void> {
    const result = await this.gmailService.getMessages({
      maxResults: 15,
      query: 'from:meetings-noreply@google.com newer_than:7d',
    });

    if (!result.success || !result.messages?.length) {
      return;
    }

    for (const message of result.messages) {
      const subject = message.subject || '';
      if (!this.looksLikeMeetingRecordSubject(subject)) {
        continue;
      }

      const fullMessage = await this.gmailService.getMessage(message.id);
      const body = fullMessage.message?.body || message.snippet || '';
      const detectionKey = `gmail:${message.id}`;
      const meetingTitle = this.extractMeetingTitleFromEmail(subject);
      const meetingCode = this.extractMeetingCode(`${subject} ${body}`);
      const directTranscriptFileId = this.extractDriveFileId(body);
      const matchedTranscriptFile = directTranscriptFileId
        ? null
        : this.matchTranscriptFile(recentTranscriptFiles, meetingCode, meetingTitle);
      const resolvedFileId = directTranscriptFileId || matchedTranscriptFile?.id || null;

      await this.detectionStore.upsertCandidate({
        ownerUserId: user.ownerUserId,
        detectionKey,
        sourceType: 'gmail',
        meetingTitle,
        meetingCode,
        gmailMessageId: message.id,
        driveFileId: resolvedFileId,
        status: resolvedFileId ? 'detected' : 'transcript_pending',
        metadata: {
          subject,
          from: message.from,
          date: message.date.toISOString(),
          detected_via: 'gmail',
        },
      });

      if (resolvedFileId) {
        await this.processTranscriptFile({
          user,
          detectionKey,
          fileId: resolvedFileId,
          meetingTitle,
          sourceRef: `gmail:${message.id}`,
          file: matchedTranscriptFile || undefined,
        });
      }
    }
  }

  private async scanDriveTranscripts(user: PassiveDetectionUserContext, recentTranscriptFiles: DriveFile[]): Promise<void> {
    if (!recentTranscriptFiles.length) {
      return;
    }

    for (const file of recentTranscriptFiles) {
      const detectionKey = `drive:${file.id}`;
      const meetingTitle = this.inferMeetingTitleFromFile(file);

      await this.detectionStore.upsertCandidate({
        ownerUserId: user.ownerUserId,
        detectionKey,
        sourceType: 'drive',
        meetingTitle,
        meetingCode: this.extractMeetingCode(file.name),
        driveFileId: file.id,
        status: 'detected',
        metadata: {
          file_name: file.name,
          web_view_link: file.webViewLink || null,
          created_time: file.createdTime || null,
          detected_via: 'drive',
        },
      });

      await this.processTranscriptFile({
        user,
        detectionKey,
        fileId: file.id,
        meetingTitle,
        sourceRef: file.webViewLink || `drive:${file.id}`,
        file,
      });
    }
  }

  private async processTranscriptFile(input: {
    user: PassiveDetectionUserContext;
    detectionKey: string;
    fileId: string;
    meetingTitle: string | null;
    sourceRef: string;
    file?: DriveFile;
  }): Promise<void> {
    const existing = await this.detectionStore.getByDetectionKey(input.detectionKey);
    if (existing?.workflow_run_id) {
      return;
    }

    await this.detectionStore.markStatus(input.detectionKey, 'processing');

    try {
      const result = await this.workflowService.createDriveRun({
        ownerUserId: input.user.ownerUserId,
        originChannel: 'system',
        originRef: input.sourceRef,
        meetingTitle: input.meetingTitle,
        meetingType: 'google_meet',
        defaultTeamId: null,
        defaultProjectId: null,
        fileIdOrUrl: input.fileId,
      });

      await this.detectionStore.markRunCreated(input.detectionKey, result.detail.run.id);

      const alreadyNotified = await this.detectionStore.hasNotifiedRun(result.detail.run.id);
      if (!alreadyNotified) {
        await this.notifyUser(input.user, result.detail, input.file);
        await this.detectionStore.markStatus(input.detectionKey, 'notified', {
          metadata: { deduplicated: result.deduplicated },
        });
      } else {
        await this.detectionStore.markStatus(input.detectionKey, 'run_created', {
          metadata: {
            deduplicated: result.deduplicated,
            notification_skipped: true,
          },
        });
      }
    } catch (error: any) {
      await this.detectionStore.markStatus(input.detectionKey, 'error', {
        errorMessage: error?.message || String(error),
      });
      console.error('[MeetingPassiveDetection] Failed to process transcript:', error);
    }
  }

  private async notifyUser(user: PassiveDetectionUserContext, detail: MeetingRunDetail, file?: DriveFile): Promise<void> {
    const sessions = getAllWhatsAppSessions().filter((session) => session.userId === user.ownerUserId);
    const whatsappConnected = this.whatsappService?.getStatus().connected;
    if (this.whatsappService && whatsappConnected && sessions.length > 0) {
      const session = sessions[0];
      const cleanPhoneNumber = session.phoneNumber.replace(/\D/g, '');
      const jid = `${cleanPhoneNumber}@s.whatsapp.net`;
      const sessionKey = cleanPhoneNumber;

      if (!MeetingWorkflowManager.isActive(sessionKey)) {
        await MeetingWorkflowManager.startWorkflowForExistingRun(
          sessionKey,
          jid,
          cleanPhoneNumber,
          this.whatsappService,
          this.workflowService,
          detail.run.id,
          [
            'Detecte una reunion nueva y ya cargue la transcripcion.',
            `Titulo: ${detail.run.meeting_title || file?.name || 'Sin titulo'}`,
            `Run: ${detail.run.id}`,
            'Usa "estado", "acciones", "aprobar resumen", "aprobar accion N" o "sincronizar".',
          ].join('\n'),
        );
      } else {
        await this.whatsappService.sendText(
          jid,
          [
            'Detecte una reunion nueva, pero ya tienes otro workflow activo.',
            `Run: ${detail.run.id}`,
            `Titulo: ${detail.run.meeting_title || file?.name || 'Sin titulo'}`,
            'Cuando termines el workflow actual, revisala desde la app en la pestana Meetings.',
          ].join('\n'),
        );
      }
      return;
    }

    this.emit('meeting-detected', {
      runId: detail.run.id,
      ownerUserId: user.ownerUserId,
      meetingTitle: detail.run.meeting_title,
      sourceFileName: file?.name || null,
    });
  }

  private async fetchRecentCalendarMeetings(): Promise<CalendarMeetingSignal[]> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) {
      return [];
    }

    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const timeMax = new Date().toISOString();

    const response = await (calendar.events.list as any)({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
      conferenceDataVersion: 1,
      fields: 'items(id,summary,start,end,location,description,hangoutLink,conferenceData,updated)',
    });

    const items = Array.isArray(response?.data?.items) ? response.data.items : [];
    return items
      .filter((item: any) => this.hasGoogleMeetSignal(item))
      .map((item: any): CalendarMeetingSignal => ({
        id: item.id || '',
        title: item.summary || 'Reunion sin titulo',
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        meetUrl: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || null,
        meetingCode: this.extractMeetingCode(
          `${item.summary || ''} ${item.hangoutLink || ''} ${item.conferenceData?.conferenceId || ''}`,
        ),
      }))
      .filter((item: CalendarMeetingSignal) => Boolean(item.id) && Boolean(item.end));
  }

  private async fetchRecentTranscriptFiles(): Promise<DriveFile[]> {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const query = [
      `createdTime > '${since}'`,
      `mimeType = 'application/vnd.google-apps.document'`,
      `(name contains 'Transcript' or name contains 'transcrip' or name contains 'Registros de reuniones')`,
    ].join(' and ');

    const result = await this.driveService.listFiles({
      query,
      maxResults: 50,
    });

    if (!result.success || !result.files?.length) {
      return [];
    }

    return result.files;
  }

  private hasGoogleMeetSignal(item: any): boolean {
    const text = `${item.location || ''} ${item.description || ''} ${item.hangoutLink || ''}`.toLowerCase();
    return Boolean(item.hangoutLink || item.conferenceData || text.includes('meet.google.com'));
  }

  private looksLikeMeetingRecordSubject(subject: string): boolean {
    return /registros de reuniones|meeting records|transcript/i.test(subject || '');
  }

  private extractMeetingTitleFromEmail(subject: string): string | null {
    return subject
      .replace(/registros de reuniones\s*:/i, '')
      .replace(/meeting records\s*:/i, '')
      .trim() || null;
  }

  private inferMeetingTitleFromFile(file: DriveFile): string | null {
    return file.name
      .replace(/\s*-\s*transcript$/i, '')
      .replace(/\s*-\s*transcripcion$/i, '')
      .trim() || null;
  }

  private matchTranscriptFile(files: DriveFile[], meetingCode: string | null, meetingTitle: string | null): DriveFile | null {
    const normalizedTitle = this.normalizeText(meetingTitle);
    const normalizedCode = meetingCode?.toLowerCase() || null;

    for (const file of files) {
      const normalizedFileName = this.normalizeText(file.name);
      if (normalizedCode && normalizedFileName.includes(normalizedCode)) {
        return file;
      }
      if (normalizedTitle && normalizedTitle.length >= 8 && normalizedFileName.includes(normalizedTitle)) {
        return file;
      }
    }

    return null;
  }

  private extractMeetingCode(value: string): string | null {
    const match = value.match(/\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b/i);
    return match?.[0]?.toLowerCase() || null;
  }

  private extractDriveFileId(value: string): string | null {
    if (!value) return null;

    const pathMatch = value.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (pathMatch?.[1]) return pathMatch[1];

    const idParamMatch = value.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (idParamMatch?.[1]) return idParamMatch[1];

    return null;
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
