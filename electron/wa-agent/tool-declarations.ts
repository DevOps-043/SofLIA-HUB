import { dynamicToolService } from '../dynamic-tool-service';
import { GROUP_BLOCKED_TOOLS, WA_TOOL_DECLARATIONS } from '../whatsapp-tools';
import { authorizeChannelTool } from '../communication-hub/authorization';
import type { CommunicationHubService } from '../communication-hub/service';
import type { ResolvedChannelPrincipal } from '../communication-hub/types';
import { getWhatsAppToolAccessError } from '../whatsapp/access-control';
import type { WhatsAppConfig } from '../whatsapp/types';

type ToolDeclaration = { name: string } & Record<string, unknown>;

type ToolVisibilityParams = {
  isGroup: boolean;
  senderNumber: string;
  whatsappConfig: WhatsAppConfig;
  communicationHub?: CommunicationHubService | null;
};

export async function buildWhatsAppToolDeclarations(params: ToolVisibilityParams): Promise<{
  functionDeclarations: unknown[];
}> {
  const staticToolDeclarations = (WA_TOOL_DECLARATIONS as { functionDeclarations: ToolDeclaration[] }).functionDeclarations;

  // El principal se resuelve UNA sola vez por turno. Cada resolucion consulta
  // SOFIA Supabase (usuarios + membresias), asi que hacerlo por herramienta
  // multiplicaba el turno por el tamaño del catalogo (~130 consultas) antes de
  // llegar siquiera al modelo.
  const principal = await resolveHubPrincipal(params);

  const staticDeclarations = staticToolDeclarations.filter((tool) => isToolVisible(tool.name, params, principal));
  const dynamicDeclarations = canLoadDynamicTools(params, principal)
    ? await dynamicToolService.getGeminiFunctionDeclarations()
    : [];
  const mergedDeclarations = [...staticDeclarations, ...dynamicDeclarations];
  const dedupedDeclarations = Array.from(
    new Map(mergedDeclarations.map((tool) => [(tool as ToolDeclaration).name, tool])).values(),
  );

  return { functionDeclarations: dedupedDeclarations };
}

/**
 * Principal del Communication Hub, o `null` cuando no hay hub o el numero sigue
 * en el esquema legado. `null` significa "decide el mapa de permisos local", no
 * "sin permisos".
 */
async function resolveHubPrincipal(params: ToolVisibilityParams): Promise<ResolvedChannelPrincipal | null> {
  if (!params.communicationHub) return null;
  const principal = await params.communicationHub.resolvePrincipalFromWhatsApp(params.senderNumber);
  return principal.source === 'legacy' ? null : principal;
}

function isToolVisible(
  toolName: string,
  params: ToolVisibilityParams,
  principal: ResolvedChannelPrincipal | null,
): boolean {
  if (principal) {
    return authorizeChannelTool(principal, {
      provider: 'whatsapp',
      senderNumber: params.senderNumber,
      channelId: params.isGroup ? 'group' : 'dm',
      toolName,
      isGroup: params.isGroup,
    }).allowed;
  }
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, toolName, {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup && GROUP_BLOCKED_TOOLS.has(toolName),
  });
}

function canLoadDynamicTools(params: ToolVisibilityParams, principal: ResolvedChannelPrincipal | null): boolean {
  if (principal) {
    return authorizeChannelTool(principal, {
      provider: 'whatsapp',
      senderNumber: params.senderNumber,
      channelId: params.isGroup ? 'group' : 'dm',
      toolName: 'install_dynamic_toolset',
      isGroup: params.isGroup,
    }).allowed;
  }
  return !getWhatsAppToolAccessError(params.whatsappConfig, params.senderNumber, 'install_dynamic_toolset', {
    isGroup: params.isGroup,
    isGroupBlocked: params.isGroup,
  });
}
