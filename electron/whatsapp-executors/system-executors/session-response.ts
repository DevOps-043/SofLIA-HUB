import { toolResponse } from '../types';

export function sessionResponse(toolName: string, session: any, workDir: string, prefix: string, visible?: boolean) {
  return toolResponse(toolName, {
    success: true,
    message: `${prefix} con sesion ${session.id}.\nDirectorio: ${workDir}`,
    session_id: session.id,
    pid: session.pid,
    session_status: session.status,
    visible_terminal: visible,
    output_available: session.outputAvailable,
  });
}
