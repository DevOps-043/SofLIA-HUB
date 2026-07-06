import { dynamicToolService } from '../dynamic-tool-service';
import { GROUP_BLOCKED_TOOLS, WA_TOOL_DECLARATIONS } from '../whatsapp-tools';
import { authorizeChannelTool } from '../communication-hub/authorization';
import type { CommunicationHubService } from '../communication-hub/service';
import { getWhatsAppToolAccessError } from '../whatsapp/access-control';
import type { WhatsAppConfig } from '../whatsapp/types';

type ToolDeclaration = { name: string } & Record<string, unknown>;

export async function buildWhatsAppToolDeclarations(params: {
  isGroup: boolean;
  senderNumber: string;
  whatsappConfig: WhatsAppConfig;
  communicationHub?: CommunicationHubService | null;
}): Promise<{
  functionDeclarations: unknown[];
}> {
  const staticToolDeclarations = (WA_TOOL_DECLARATIONS as { functionDeclarations: ToolDeclaration[] }).functionDeclarations;
  const staticDeclarations = (await Promise.all(
    staticToolDeclarations.map(async (tool) =>
      (await isToolVisible(tool.name, params)) ? tool : null,
    ),
  )).filter(Boolean);
  const dynamicDeclarations = await canLoadDynamicTools(params)
    ? await dynamicToolService.getGeminiFunctionDeclarations()
    : [];
  const mergedDeclarations = [...staticDeclarations, ...dynamicDeclarations];
  const dedupedDeclarations = Array.from(
    new Map(mergedDeclarations.map((tool) => [(tool as ToolDeclaration).name, tool])).values(),
  );

  return { functionDeclarations: dedupedDeclarations };
}

async function isToolVisible(
  toolName: string,
  params: { isGroup: boolean; senderNumber: string; whatsappConfig: WhatsAppConfig; communicationHub?: CommunicationHubService | null },
): Promise<boolean> {
  if (params.communicationHub) {
    const principal = await params.communicationHub.resolvePrincipalFromWhatsApp(params.senderNumber);
    if (principal.source !== 'legacy') {
      return authorizeChannelTool(principal, {
        provider: 'whatsapp',
        senderNumber: params.senderNumber,
        channelId: params.isGroup ? 'group' : 'dm',
        toolName,
        isGroup: params.isGroup,
      }).allowed;
    }
  }
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, toolName, {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup && GROUP_BLOCKED_TOOLS.has(toolName),
  });
}

async function canLoadDynamicTools(params: { isGroup: boolean; senderNumber: string; whatsappConfig: WhatsAppConfig; communicationHub?: CommunicationHubService | null }): Promise<boolean> {
  if (params.communicationHub) {
    const principal = await params.communicationHub.resolvePrincipalFromWhatsApp(params.senderNumber);
    if (principal.source !== 'legacy') {
      return authorizeChannelTool(principal, {
        provider: 'whatsapp',
        senderNumber: params.senderNumber,
        channelId: params.isGroup ? 'group' : 'dm',
        toolName: 'install_dynamic_toolset',
        isGroup: params.isGroup,
      }).allowed;
    }
  }
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, 'install_dynamic_toolset', {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup,
  });
}
