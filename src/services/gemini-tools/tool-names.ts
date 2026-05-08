import { COMPUTER_USE_TOOLS } from './computer-tools';
import { GOOGLE_WORKSPACE_TOOLS } from './google-workspace-tools';
import { NATIVE_AI_TOOLS } from './native-tools';
import { PROJECT_HUB_TOOLS } from './project-hub-tools';

export const COMPUTER_TOOL_NAMES = new Set(
  COMPUTER_USE_TOOLS.functionDeclarations.map((tool) => tool.name),
);

export const PROJECT_HUB_TOOL_NAMES = new Set(
  PROJECT_HUB_TOOLS.functionDeclarations.map((tool) => tool.name),
);

export const GOOGLE_WORKSPACE_TOOL_NAMES = new Set(
  GOOGLE_WORKSPACE_TOOLS.functionDeclarations.map((tool) => tool.name),
);

export const NATIVE_AI_TOOL_NAMES = new Set(
  NATIVE_AI_TOOLS.functionDeclarations.map((tool) => tool.name),
);
