import { dynamicToolService } from '../dynamic-tool-service';
import { GROUP_BLOCKED_TOOLS, WA_TOOL_DECLARATIONS } from '../whatsapp-tools';

export async function buildWhatsAppToolDeclarations(isGroup: boolean): Promise<{
  functionDeclarations: unknown[];
}> {
  const staticDeclarations = (WA_TOOL_DECLARATIONS as any).functionDeclarations.filter(
    (tool: any) => !isGroup || !GROUP_BLOCKED_TOOLS.has(tool.name),
  );
  const dynamicDeclarations = isGroup ? [] : await dynamicToolService.getGeminiFunctionDeclarations();
  const mergedDeclarations = [...staticDeclarations, ...dynamicDeclarations];
  const dedupedDeclarations = Array.from(
    new Map(mergedDeclarations.map((tool: any) => [tool.name, tool])).values(),
  );

  return { functionDeclarations: dedupedDeclarations };
}
