import type { ToolSchema } from './types';

export async function executeRegisteredTool(
  tools: Map<string, ToolSchema>,
  name: string,
  args: any,
): Promise<any> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  if (typeof tool.handler === 'function') return await tool.handler(args);
  throw new Error(`Tool ${name} has no executable handler. It might be a declarative tool.`);
}
