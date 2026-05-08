import { COMPUTER_AUTOMATION_TOOL_DECLARATIONS } from './computer-automation-tools';
import { COMPUTER_FILE_TOOL_DECLARATIONS } from './computer-file-tools';
import { COMPUTER_PROCESS_TOOL_DECLARATIONS } from './computer-process-tools';
import { REMOTE_NODE_TOOL_DECLARATIONS } from './remote-node-tools';
import type { GeminiToolGroup } from './types';

export const COMPUTER_USE_TOOLS: GeminiToolGroup = {
  functionDeclarations: [
    ...COMPUTER_FILE_TOOL_DECLARATIONS,
    ...COMPUTER_PROCESS_TOOL_DECLARATIONS,
    ...COMPUTER_AUTOMATION_TOOL_DECLARATIONS,
    ...REMOTE_NODE_TOOL_DECLARATIONS,
  ],
};
