import type { MeetingStore } from '../meeting-store';
import type { MeetingSyncActionRecord, MeetingSyncExecutionResult } from '../meeting-types';

export type SyncActionDetail = MeetingSyncExecutionResult['details'][number];

export interface SyncActionContext {
  store: MeetingStore;
  action: MeetingSyncActionRecord;
  ownerUserId: string;
}
