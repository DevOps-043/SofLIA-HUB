import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';

export function init(this: MeetingStore): void {
    getMeetingIrisClient();
    console.log('[MeetingStore] Using IRIS Supabase persistence');
  }
