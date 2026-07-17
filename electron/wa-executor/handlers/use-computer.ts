import type { DesktopTaskOutcome } from '../../desktop-agent/task-outcome';
import type { FunctionResponse, ToolExecutorContext } from '../types';

export async function executeUseComputerTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
): Promise<FunctionResponse> {
  try {
    if (!ctx.desktopAgent) throw new Error('Desktop Agent no inicializado.');
    const outcome = await runDesktopAgentTask(toolArgs, ctx, jid);
    return buildUseComputerResponse(toolName, outcome.estado === 'completada', outcome.mensaje, ctx.desktopAgent.getStatus(), outcome);
  } catch (err: any) {
    return buildUseComputerResponse(toolName, false, err.message, ctx.desktopAgent?.getStatus?.());
  }
}

async function runDesktopAgentTask(toolArgs: Record<string, any>, ctx: ToolExecutorContext, jid: string): Promise<DesktopTaskOutcome> {
  const progressInterval = ctx.desktopAgent!.getConfig().progressReportEveryNSteps || 25;
  const onStep = async (data: any) => {
    if (data.step % progressInterval === 0 && data.step > 0) {
      await ctx.waService.sendText(jid, `Progreso: paso ${data.step}/${data.maxSteps}\n${data.action?.message || ''}`).catch(() => {});
    }
  };
  const onPhase = async (data: any) => {
    const phaseMsg = `Fase completada: ${data.phase?.name || 'Fase'}\nProgreso: ${data.phaseIndex + 1}/${data.totalPhases}${data.nextPhase ? `\nSiguiente: ${data.nextPhase.name}` : '\nUltima fase completada'}`;
    await ctx.waService.sendText(jid, phaseMsg).catch(() => {});
  };

  ctx.desktopAgent!.on('step', onStep);
  ctx.desktopAgent!.on('phase-completed', onPhase);
  try {
    return await ctx.desktopAgent!.executeTaskDetailed(toolArgs.task, {
      maxSteps: toolArgs.max_steps,
      backend: toolArgs.backend,
      startUrl: toolArgs.start_url,
      browserProfile: toolArgs.browser_profile,
      browserIsolated: toolArgs.browser_isolated,
      resetBrowserProfile: toolArgs.reset_browser_profile,
      useRealBrowser: toolArgs.use_real_browser,
    });
  } finally {
    ctx.desktopAgent!.removeListener('step', onStep);
    ctx.desktopAgent!.removeListener('phase-completed', onPhase);
  }
}

function buildUseComputerResponse(
  toolName: string,
  success: boolean,
  message: string,
  agentStatus: any,
  outcome?: DesktopTaskOutcome,
): FunctionResponse {
  return {
    functionResponse: {
      name: toolName,
      response: {
        success,
        ...(success ? { message } : { error: message }),
        // Contrato de finalizacion: SOLO afirmar exito al usuario con estado
        // 'completada'; con 'presupuesto_agotado'/'fallida' reportar el
        // progreso real y preguntar si continuar.
        estado: outcome?.estado ?? (success ? 'completada' : 'fallida'),
        pasos_ejecutados: outcome?.pasosEjecutados,
        duracion_ms: outcome?.duracionMs,
        ultima_ventana: outcome?.ultimaVentana || null,
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
  };
}
