import type { DriveService } from '../../drive-service';

export type DriveServiceTestContext = {
  getService: () => DriveService;
};
