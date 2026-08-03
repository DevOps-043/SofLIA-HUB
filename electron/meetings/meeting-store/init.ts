import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingHubClient } from '../meeting-hub-client';

export function init(this: MeetingStore): void {
    getMeetingHubClient();
    console.log('[MeetingStore] Persistencia en la base de Pulse Hub (IRIS solo recibe lo compartido).');
  }
