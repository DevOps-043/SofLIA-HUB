import './mocks';
import { GmailService } from '../../gmail-service';
import { mockGetGoogleAuth } from './mocks';
import type { CalendarService } from '../../calendar-service';
export {
  mockGetGoogleAuth,
  mockLabelsCreate,
  mockMessagesList,
  mockMessagesModify,
  mockMessagesTrash,
} from './mocks';

export const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
  userId: 'usuario', contextRevision: 0,
  connections: new Map([['google', { provider: 'google', userId: 'usuario', email: 'cuenta@example.test', isActive: true }]]),
} as unknown as CalendarService;

export function createGmailService(): GmailService {
  return new GmailService(mockCalendarService);
}
