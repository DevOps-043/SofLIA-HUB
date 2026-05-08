import { backgroundProcessService } from '../background-process-service';
import { validateCommandSafety } from './command-security';

export async function handleRunBackgroundCommand(args: Record<string, any>): Promise<Record<string, any>> {
  try {
    const command = validateCommandSafety(args.command);
    const session = await backgroundProcessService.startBackgroundCommand({
      command,
      workingDirectory: typeof args.working_directory === 'string' ? args.working_directory : undefined,
      title: args.title || 'Comando en segundo plano',
      metadata: { source: 'computer-use' },
    });
    return { success: true, message: `Comando lanzado en segundo plano con sesion ${session.id}.`, session };
  } catch (err: any) {
    return { success: false, error: `No se pudo iniciar la sesion en segundo plano: ${err.message}` };
  }
}

export async function handleListProcessSessions(): Promise<Record<string, any>> {
  try {
    const sessions = await backgroundProcessService.listSessions();
    return { success: true, count: sessions.length, sessions };
  } catch (err: any) {
    return { success: false, error: `No se pudieron listar las sesiones: ${err.message}` };
  }
}

export async function handlePollProcessSession(args: Record<string, any>): Promise<Record<string, any>> {
  try {
    if (!args.session_id || typeof args.session_id !== 'string') {
      return { success: false, error: 'Debe proporcionar session_id.' };
    }
    const session = await backgroundProcessService.getSession(args.session_id);
    return session ? { success: true, session } : { success: false, error: `No existe la sesion ${args.session_id}.` };
  } catch (err: any) {
    return { success: false, error: `No se pudo consultar la sesion: ${err.message}` };
  }
}

export async function handleKillProcessSession(args: Record<string, any>): Promise<Record<string, any>> {
  try {
    if (!args.session_id || typeof args.session_id !== 'string') {
      return { success: false, error: 'Debe proporcionar session_id.' };
    }
    const session = await backgroundProcessService.killSession(args.session_id);
    if (!session) return { success: false, error: `No existe la sesion ${args.session_id}.` };
    return {
      success: true,
      message: session.status === 'killed'
        ? `Sesion ${session.id} terminada.`
        : `Sesion ${session.id} no estaba corriendo o no pudo terminarse.`,
      session,
    };
  } catch (err: any) {
    return { success: false, error: `No se pudo terminar la sesion: ${err.message}` };
  }
}
