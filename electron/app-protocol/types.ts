export type MeetingTriggerAction = 'start' | 'stop' | 'heartbeat';

export interface MeetingTriggerPayload {
  action: MeetingTriggerAction;
  provider: string | null;
  meetingTitle: string | null;
  meetingUrl: string | null;
  meetingCode: string | null;
  tabUrl: string | null;
  tabId: string | null;
  detectedAt: string;
  source: string | null;
  reason: string | null;
  extensionVersion: string | null;
  browser: string | null;
  triggerId: string;
  rawUrl: string;
}

export type AppProtocolCommand =
  | {
      type: 'share-link';
      shareLink: string;
      rawUrl: string;
    }
  | {
      type: 'meeting-trigger';
      payload: MeetingTriggerPayload;
    }
  | null;
