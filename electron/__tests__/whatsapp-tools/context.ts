import {
  BLOCKED_TOOLS_WA,
  CONFIRM_TOOLS_WA,
  GROUP_BLOCKED_TOOLS,
  WA_TOOL_DECLARATIONS,
} from '../../whatsapp-tools';

export const tools = WA_TOOL_DECLARATIONS.functionDeclarations;
export const toolMap = new Map(tools.map((tool: any) => [tool.name, tool]));

export { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS };
