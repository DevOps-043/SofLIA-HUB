import { CALENDAR_TOOLS } from './google/calendar';
import { DRIVE_TOOLS } from './google/drive';
import { GCHAT_TOOLS } from './google/gchat';
import { GMAIL_MESSAGE_TOOLS } from './google/gmail-messages';
import { GMAIL_ORGANIZATION_TOOLS } from './google/gmail-organization';
import type { GoogleToolDeclaration } from './google/types';

export const GOOGLE_TOOLS: GoogleToolDeclaration[] = [
  ...CALENDAR_TOOLS,
  ...GMAIL_MESSAGE_TOOLS,
  ...GMAIL_ORGANIZATION_TOOLS,
  ...DRIVE_TOOLS,
  ...GCHAT_TOOLS,
];
