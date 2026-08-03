/**
 * Handlers para gestión de toolsets dinámicos.
 *
 * Pulse Hub soporta plugins/toolsets que se cargan en runtime desde
 * `userData/toolsets/`. Estos handlers cubren la inspección, instalación
 * y desinstalación de toolsets disponibles.
 *
 * El "atajo" `install_home_assistant_toolset` está aquí porque es uno de
 * los toolsets más usados y vale la pena exponerlo como tool dedicado en
 * lugar de exigir al modelo recordar el toolset_id.
 */

import { createHash, randomUUID } from 'node:crypto';
import { dynamicToolService } from '../../dynamic-tool-service';
import type { RuntimeToolPolicy } from '../../mcp-manager';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

const TOOLSET_TOOLS = new Set([
  'list_dynamic_tools',
  'list_installable_toolsets',
  'list_installed_toolsets',
  'doctor_dynamic_toolsets',
  'install_dynamic_toolset',
  'uninstall_dynamic_toolset',
  'install_home_assistant_toolset',
]);

export function isDynamicToolsetTool(name: string): boolean {
  return TOOLSET_TOOLS.has(name);
}

export async function executeDynamicToolsetTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<FunctionResponse | null> {
  if (!TOOLSET_TOOLS.has(toolName)) {
    return null;
  }

  try {
    switch (toolName) {
      case 'list_dynamic_tools': {
        const tools = await dynamicToolService.listTools();
        return buildResponse(toolName, { success: true, count: tools.length, tools });
      }

      case 'list_installable_toolsets': {
        const toolsets = await dynamicToolService.listInstallableToolsets();
        return buildResponse(toolName, { success: true, count: toolsets.length, toolsets });
      }

      case 'list_installed_toolsets': {
        const toolsets = await dynamicToolService.listInstalledToolsets();
        return buildResponse(toolName, { success: true, count: toolsets.length, toolsets });
      }

      case 'doctor_dynamic_toolsets': {
        const diagnostics = await dynamicToolService.doctorToolsets();
        return buildResponse(toolName, { success: true, count: diagnostics.length, diagnostics });
      }

      case 'install_dynamic_toolset': {
        const result = await dynamicToolService.installToolset(
          String(toolArgs.toolset_id || '').trim(),
        );
        return buildResponse(toolName, result);
      }

      case 'uninstall_dynamic_toolset': {
        const result = await dynamicToolService.uninstallToolset(
          String(toolArgs.toolset_id || '').trim(),
        );
        return buildResponse(toolName, result);
      }

      case 'install_home_assistant_toolset': {
        const result = await dynamicToolService.installHomeAssistantToolset();
        return buildResponse(toolName, result);
      }

      default:
        return null;
    }
  } catch (error: unknown) {
    return errorResponse(toolName, getErrorMessage(error));
  }
}

/**
 * Despacha tools cargadas dinámicamente desde un toolset instalado.
 * Solo se ejecuta si NO estamos en un grupo (los toolsets dinámicos son
 * potencialmente sensibles y no deben ser controlables por miembros del grupo).
 *
 * Devuelve `null` si la tool no existe en el toolset registry.
 */
export async function executeDynamicTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<FunctionResponse | null> {
  if (!(await dynamicToolService.hasTool(toolName))) return null;

  try {
    const descriptor = await dynamicToolService.getRuntimeDescriptor(toolName);
    if (!descriptor) throw new Error(`La herramienta ${toolName} no tiene una política runtime ejecutable.`);
    const { policy, contractFingerprint } = descriptor;

    let approvedByHuman = false;
    if (policy.hitl === 'required' && !(isGroup && !policy.allowInGroups)) {
      approvedByHuman = await ctx.requestConfirmation(
        jid,
        senderNumber,
        toolName,
        buildDynamicConfirmationDescription(toolName, policy),
        {},
      );
    }

    const result = await dynamicToolService.executeTool(toolName, toolArgs, {
      agentId: 'whatsapp-agent',
      channel: 'whatsapp',
      isGroup,
      approvedByHuman,
      traceId: randomUUID(),
      contractFingerprint,
      actorRef: createActorRef(senderNumber),
    });
    return buildResponse(
      toolName,
      typeof result === 'object' && result !== null ? result as Record<string, unknown> : { success: true, result },
    );
  } catch (error: unknown) {
    return errorResponse(toolName, getErrorMessage(error));
  }
}

function buildDynamicConfirmationDescription(toolName: string, policy: RuntimeToolPolicy): string {
  return `Ejecutar herramienta dinámica "${toolName}" (riesgo: ${policy.risk}; responsable: ${policy.owner}).`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createActorRef(senderNumber: string): string {
  const digest = createHash('sha256').update(senderNumber).digest('hex').slice(0, 16);
  return `wa:${digest}`;
}
