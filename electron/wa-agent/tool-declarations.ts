import { dynamicToolService } from '../dynamic-tool-service';
import { GROUP_BLOCKED_TOOLS, WA_TOOL_DECLARATIONS } from '../whatsapp-tools';
import { getWhatsAppToolAccessError } from '../whatsapp/access-control';
import type { WhatsAppConfig } from '../whatsapp/types';

export async function buildWhatsAppToolDeclarations(params: {
  isGroup: boolean;
  senderNumber: string;
  whatsappConfig: WhatsAppConfig;
}): Promise<{
  functionDeclarations: unknown[];
}> {
  const staticDeclarations = (WA_TOOL_DECLARATIONS as any).functionDeclarations.filter(
    (tool: any) => isToolVisible(tool.name, params),
  );
  const dynamicDeclarations = canLoadDynamicTools(params)
    ? await dynamicToolService.getGeminiFunctionDeclarations()
    : [];
  const mergedDeclarations = [...staticDeclarations, ...dynamicDeclarations];
  const dedupedDeclarations = Array.from(
    new Map(mergedDeclarations.map((tool: any) => [tool.name, tool])).values(),
  );

  return { functionDeclarations: dedupedDeclarations };
}

function isToolVisible(
  toolName: string,
  params: { isGroup: boolean; senderNumber: string; whatsappConfig: WhatsAppConfig },
): boolean {
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, toolName, {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup && GROUP_BLOCKED_TOOLS.has(toolName),
  });
}

function canLoadDynamicTools(params: { isGroup: boolean; senderNumber: string; whatsappConfig: WhatsAppConfig }): boolean {
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, 'install_dynamic_toolset', {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup,
  });
}
