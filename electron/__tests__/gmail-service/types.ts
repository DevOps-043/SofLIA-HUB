import type { GmailService } from '../../gmail-service';

export type GmailServiceTestContext = {
  getService: () => GmailService;
};
