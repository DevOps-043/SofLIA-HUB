import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingSyncActionState } from '../meeting-types';

export function countActions(this: MeetingStore, rows: Array<{ approval_state: string; sync_state: string }>, state: MeetingSyncActionState): number {
    return rows.filter((row) => row.approval_state === state || row.sync_state === state).length;
  }
