import './mocks';
import { GmailService } from '../../gmail-service';
import { mockGetGoogleAuth } from './mocks';
export {
  mockGetGoogleAuth,
  mockLabelsCreate,
  mockMessagesList,
  mockMessagesModify,
  mockMessagesTrash,
} from './mocks';

export const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
} as any;

export function createGmailService(): GmailService {
  return new GmailService(mockCalendarService);
}
