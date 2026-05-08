import { DRIVE_TOOL_DECLARATIONS } from './drive-tools';
import { GOOGLE_CALENDAR_TOOL_DECLARATIONS } from './google-calendar-tools';
import { GMAIL_TOOL_DECLARATIONS } from './gmail-tools';
import type { GeminiToolGroup } from './types';

export const GOOGLE_WORKSPACE_TOOLS: GeminiToolGroup = {
  functionDeclarations: [
    ...GOOGLE_CALENDAR_TOOL_DECLARATIONS.slice(0, 3),
    ...GMAIL_TOOL_DECLARATIONS,
    ...DRIVE_TOOL_DECLARATIONS,
    GOOGLE_CALENDAR_TOOL_DECLARATIONS[3],
  ],
};
