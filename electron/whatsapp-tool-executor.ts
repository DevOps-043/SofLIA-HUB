/**
 * WhatsApp Tool Executor — extraído de whatsapp-agent.ts
 * Contiene la lógica de despacho para ~60 tools del agente WhatsApp.
 */
import { executeToolDirect } from './computer-use-handlers';
import { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from './whatsapp-tools';
import { isGoogleTool, executeGoogleTool } from './whatsapp-executors/google-executors';
import { isIrisTool, executeIrisTool } from './whatsapp-executors/iris-executors';
import { isSystemTool, executeSystemTool } from './whatsapp-executors/system-executors';
import { buildConfirmationDescription } from './wa-executor/confirmations';
import { executeAppChatTool, isAppChatTool } from './wa-executor/handlers/app-chat';
import { handleCreateDocument } from './wa-executor/handlers/create-document';
import {
  executeDynamicTool,
  executeDynamicToolsetTool,
  isDynamicToolsetTool,
} from './wa-executor/handlers/dynamic-toolsets';
import { executeDeliveryTool, isDeliveryTool } from './wa-executor/handlers/delivery';
import { executeMemoryTool, isMemoryTool } from './wa-executor/handlers/memory';
import { executeMiscTool, isMiscTool } from './wa-executor/handlers/misc';
import { executeRemoteNodeTool, isRemoteNodeTool } from './wa-executor/handlers/remote-nodes';
import { detectProtectedPathAccess } from './wa-executor/security';
import type { FunctionResponse, ToolExecutorContext } from './wa-executor/types';

export type { FunctionResponse, ToolExecutorContext } from './wa-executor/types';

/**
 * Ejecuta todos los function calls de una iteración del agent loop.
 * Retorna las respuestas y un set de labels para verificación bulk.
 */
export async function executeWhatsAppTools(
  functionCalls: any[],
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<{ responses: FunctionResponse[]; bulkLabelsToVerify: Set<string> | null }> {
  const functionResponses: FunctionResponse[] = [];
  let bulkLabelsToVerify: Set<string> | null = null;

for (const part of functionCalls) {
  const fc = (part as any).functionCall;
  const toolName: string = fc.name;
  const toolArgs: Record<string, any> = fc.args || {};

  // Security: Block disallowed tools
  if (BLOCKED_TOOLS_WA.has(toolName)) {
    functionResponses.push({
      functionResponse: {
        name: toolName,
        response: { success: false, error: 'Esta herramienta no está disponible por WhatsApp por seguridad.' },
      },
    });
    continue;
  }

  // Group Security: Block powerful tools in groups
  if (isGroup && GROUP_BLOCKED_TOOLS.has(toolName)) {
    functionResponses.push({
      functionResponse: {
        name: toolName,
        response: { success: false, error: 'Esta herramienta no está permitida en grupos por seguridad.' },
      },
    });
    continue;
  }

  // ─── SECURITY: Block access to SofLIA's own code/config ─────────
  // Previene el ataque donde la IA usa execute_command, read_file, etc.
  // para leer su propio código, API keys o system prompt.
  const protectedPathError = detectProtectedPathAccess(toolName, toolArgs);
  if (protectedPathError) {
    functionResponses.push({
      functionResponse: { name: toolName, response: { success: false, error: protectedPathError } },
    });
    continue;
  }

  // Confirmación para tools peligrosos antes de cualquier ejecución.
  if (CONFIRM_TOOLS_WA.has(toolName) && !ctx.skipConfirmations) {
    const desc = buildConfirmationDescription(toolName, toolArgs);
    const confirmed = await ctx.requestConfirmation(jid, senderNumber, toolName, desc, toolArgs);

    if (!confirmed) {
      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: { success: false, error: 'Acción cancelada por el usuario.' },
        },
      });
      continue;
    }
  }

  // ─── Delegated executors (domain-specific modules) ────────────
  if (isGoogleTool(toolName)) {
    const result = await executeGoogleTool(toolName, toolArgs, ctx, bulkLabelsToVerify);
    if (result) {
      functionResponses.push(result.response);
      bulkLabelsToVerify = result.bulkLabelsToVerify;
      continue;
    }
  }

  if (isIrisTool(toolName)) {
    const result = await executeIrisTool(toolName, toolArgs, senderNumber);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (isSystemTool(toolName)) {
    const result = await executeSystemTool(toolName, toolArgs);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (isAppChatTool(toolName)) {
    const result = await executeAppChatTool(toolName, toolArgs, ctx, jid, senderNumber);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (isDynamicToolsetTool(toolName)) {
    const result = await executeDynamicToolsetTool(toolName, toolArgs);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  // Tools cargadas dinamicamente desde toolsets instalados (con bypass en grupos).
  const dynamicResult = await executeDynamicTool(toolName, toolArgs, isGroup);
  if (dynamicResult) {
    functionResponses.push(dynamicResult);
    continue;
  }
  // Handle whatsapp_send_file specially

  if (isDeliveryTool(toolName)) {
    const result = await executeDeliveryTool(toolName, toolArgs, ctx, jid);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (isMiscTool(toolName)) {
    const result = await executeMiscTool(toolName, toolArgs, ctx, senderNumber);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }
  if (isRemoteNodeTool(toolName)) {
    const result = await executeRemoteNodeTool(toolName, toolArgs);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (toolName === 'use_computer') {
    try {
      if (!ctx.desktopAgent) throw new Error('Desktop Agent no inicializado.');

      // V2: Set up progress reporting for long tasks
      const progressInterval = ctx.desktopAgent.getConfig().progressReportEveryNSteps || 25;
      const onStep = async (data: any) => {
        if (data.step % progressInterval === 0 && data.step > 0) {
          try {
            const progressMsg = `🖥️ Progreso: paso ${data.step}/${data.maxSteps}\n${data.action?.message || ''}`;
            await ctx.waService.sendText(jid, progressMsg);
          } catch { /* progress report is best-effort */ }
        }
      };
      const onPhase = async (data: any) => {
        try {
          const phaseMsg = `✅ Fase completada: ${data.phase?.name || 'Fase'}\nProgreso: ${data.phaseIndex + 1}/${data.totalPhases}${data.nextPhase ? `\nSiguiente: ${data.nextPhase.name}` : '\n🏁 Última fase completada'}`;
          await ctx.waService.sendText(jid, phaseMsg);
        } catch { /* phase report is best-effort */ }
      };
      ctx.desktopAgent.on('step', onStep);
      ctx.desktopAgent.on('phase-completed', onPhase);

      let result = '';
      try {
        result = await ctx.desktopAgent.executeTask(
          toolArgs.task,
          {
            maxSteps: toolArgs.max_steps,
            backend: toolArgs.backend,
            startUrl: toolArgs.start_url,
            browserProfile: toolArgs.browser_profile,
            browserIsolated: toolArgs.browser_isolated,
            resetBrowserProfile: toolArgs.reset_browser_profile,
          },
        );
      } finally {
        ctx.desktopAgent.removeListener('step', onStep);
        ctx.desktopAgent.removeListener('phase-completed', onPhase);
      }

      const agentStatus = ctx.desktopAgent.getStatus();

      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: {
            success: true,
            message: result,
            current_backend: agentStatus.currentBackend || null,
            current_url: agentStatus.currentUrl || null,
            current_browser_profile: agentStatus.currentBrowserProfileId || null,
            current_browser_profile_mode: agentStatus.currentBrowserProfileMode || null,
            last_verification: agentStatus.lastVerification || null,
            trace_path: agentStatus.lastTracePath || null,
            report_path: agentStatus.lastReportPath || null,
            screenshot_path: agentStatus.lastScreenshotPath || null,
          },
        },
      });
    } catch (err: any) {
      const agentStatus = ctx.desktopAgent?.getStatus?.();
      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: {
            success: false,
            error: err.message,
            current_backend: agentStatus?.currentBackend || null,
            current_url: agentStatus?.currentUrl || null,
            current_browser_profile: agentStatus?.currentBrowserProfileId || null,
            current_browser_profile_mode: agentStatus?.currentBrowserProfileMode || null,
            last_verification: agentStatus?.lastVerification || null,
            trace_path: agentStatus?.lastTracePath || null,
            report_path: agentStatus?.lastReportPath || null,
            screenshot_path: agentStatus?.lastScreenshotPath || null,
          },
        },
      });
    }
    continue;
  }

  // Handle save_lesson → persisted via MemoryService facts
  if (isMemoryTool(toolName)) {
    const result = await executeMemoryTool(toolName, toolArgs, ctx, senderNumber);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (toolName === 'create_document') {
    functionResponses.push(await handleCreateDocument(toolArgs, ctx));
    continue;
  }



  // Execute the tool via computer-use-handlers (fallback for all other tools)
  try {
    const result = await executeToolDirect(toolName, toolArgs);
    functionResponses.push({
      functionResponse: { name: toolName, response: result },
    });
  } catch (err: any) {
    functionResponses.push({
      functionResponse: {
        name: toolName,
        response: { success: false, error: err.message },
      },
    });
  }
  }

  return { responses: functionResponses, bulkLabelsToVerify };
}
