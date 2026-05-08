import './mocks';
import { DriveService } from '../../drive-service';
import { mockGetGoogleAuth } from './mocks';
export {
  mockFilesCreate,
  mockFilesDelete,
  mockFilesExport,
  mockFilesGet,
  mockFilesList,
} from './mocks';

export const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
} as any;

export function createDriveService(): DriveService {
  return new DriveService(mockCalendarService);
}
