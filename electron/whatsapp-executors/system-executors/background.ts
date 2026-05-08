import os from 'node:os';
import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { backgroundProcessService } from '../../background-process-service';
import { backgroundHostService } from '../../background-host-service';
import { validateCommandSafety } from '../../security/command-policy';
import { resolveClaudePath } from './claude-path';
import { sessionResponse } from './session-response';

const BACKGROUND_TOOLS = new Set([
  'run_in_terminal',
  'run_claude_code',
  'run_background_command',
  'list_process_sessions',
  'poll_process_session',
  'kill_process_session',
  'get_background_host_status',
  'repair_background_host',
]);

export async function executeBackgroundSystemTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (!BACKGROUND_TOOLS.has(toolName)) return null;

  try {
    if (toolName === 'run_in_terminal') return runTerminal(toolName, toolArgs);
    if (toolName === 'run_claude_code') return runClaude(toolName, toolArgs);
    if (toolName === 'run_background_command') return runBackgroundCommand(toolName, toolArgs);
    if (toolName === 'list_process_sessions') return toolResponse(toolName, { success: true, count: (await backgroundProcessService.listSessions()).length, sessions: await backgroundProcessService.listSessions() });
    if (toolName === 'poll_process_session') return pollSession(toolName, toolArgs);
    if (toolName === 'kill_process_session') return killSession(toolName, toolArgs);
    if (toolName === 'get_background_host_status') return toolResponse(toolName, { success: true, status: await backgroundHostService.getStatus() });
    return toolResponse(toolName, { success: true, message: 'Background host reparado o reconfigurado.', status: await backgroundHostService.repair() });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}

async function runTerminal(toolName: string, toolArgs: Record<string, any>) {
  const workDir = toolArgs.working_directory || os.homedir();
  const visible = toolArgs.visible_terminal !== false;
  const command = validateCommandSafety(toolArgs.command);
  const session = visible
    ? await backgroundProcessService.startVisibleTerminal({
        command,
        workingDirectory: workDir,
        keepOpen: toolArgs.keep_open !== false,
        title: 'Terminal administrada',
        metadata: { source: 'whatsapp', tool: toolName },
      })
    : await backgroundProcessService.startBackgroundCommand({
        command,
        workingDirectory: workDir,
        title: 'Comando en segundo plano',
        metadata: { source: 'whatsapp', tool: toolName },
      });
  return sessionResponse(toolName, session, workDir, visible ? 'Terminal lanzada' : 'Comando iniciado en segundo plano', visible);
}

async function runClaude(toolName: string, toolArgs: Record<string, any>) {
  const projectDir = toolArgs.project_directory || os.homedir();
  const task = toolArgs.task || '';
  const claudePath = await resolveClaudePath();
  const command = `& '${claudePath.replace(/'/g, "''")}' --print '${task.replace(/'/g, "''")}'`;
  const session = await backgroundProcessService.startBackgroundCommand({
    command,
    workingDirectory: projectDir,
    title: 'Claude Code en segundo plano',
    kind: 'claude',
    metadata: { source: 'whatsapp', tool: toolName, task },
  });
  return sessionResponse(toolName, session, projectDir, 'Claude Code iniciado en segundo plano');
}

async function runBackgroundCommand(toolName: string, toolArgs: Record<string, any>) {
  const workDir = toolArgs.working_directory || os.homedir();
  const command = validateCommandSafety(toolArgs.command);
  const session = await backgroundProcessService.startBackgroundCommand({
    command,
    workingDirectory: workDir,
    title: toolArgs.title || 'Comando en segundo plano',
    metadata: { source: 'whatsapp', tool: toolName },
  });
  return sessionResponse(toolName, session, workDir, 'Comando lanzado en segundo plano');
}

async function pollSession(toolName: string, toolArgs: Record<string, any>) {
  const sessionId = String(toolArgs.session_id || '');
  if (!sessionId) return toolResponse(toolName, { success: false, error: 'Debes proporcionar session_id.' });
  const session = await backgroundProcessService.getSession(sessionId);
  return session
    ? toolResponse(toolName, { success: true, session })
    : toolResponse(toolName, { success: false, error: `No existe la sesion ${sessionId}.` });
}

async function killSession(toolName: string, toolArgs: Record<string, any>) {
  const sessionId = String(toolArgs.session_id || '');
  if (!sessionId) return toolResponse(toolName, { success: false, error: 'Debes proporcionar session_id.' });
  const session = await backgroundProcessService.killSession(sessionId);
  return session
    ? toolResponse(toolName, { success: true, message: session.status === 'killed' ? `Sesion ${session.id} terminada.` : `Sesion ${session.id} ya no estaba corriendo o no pudo terminarse.`, session })
    : toolResponse(toolName, { success: false, error: `No existe la sesion ${sessionId}.` });
}
