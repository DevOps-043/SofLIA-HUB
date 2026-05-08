import {
  buildIrisContextForWhatsApp,
  getWhatsAppSession,
  isIrisAvailable,
  needsIrisData,
  tryAutoAuthByPhone,
} from '../iris-data-main';
import type { CalendarService } from '../calendar-service';
import { buildSystemPrompt } from '../whatsapp-prompts';
import { getSensitiveRequestBlockResponse } from './security-prefilter';
import { buildWhatsAppPromptMemoryContext } from './prompt-memory-context';
import type { WhatsAppAgentPromptContextInput } from './system-prompt-context-types';

export async function buildWhatsAppAgentPromptContext(
  input: WhatsAppAgentPromptContextInput,
): Promise<{ sensitiveBlockResponse?: string; sessionKey: string; systemPrompt: string }> {
  const sensitiveBlockResponse = getSensitiveRequestBlockResponse(input.userMessage, input.senderNumber, input.isGroup);
  const sessionKey = input.isGroup ? `group:${input.jid}:${input.senderNumber}` : input.senderNumber;
  if (sensitiveBlockResponse) return { sensitiveBlockResponse, sessionKey, systemPrompt: '' };

  const promptMemoryContext = await buildWhatsAppPromptMemoryContext({
    memory: input.memory,
    knowledge: input.knowledge,
    sessionKey,
    senderNumber: input.senderNumber,
    userMessage: input.userMessage,
  });

  input.memory.saveMessage({
    sessionKey,
    phoneNumber: input.senderNumber,
    groupJid: input.isGroup ? input.jid : undefined,
    role: 'user',
    content: input.userMessage,
  });

  let systemPrompt = await buildSystemPrompt(promptMemoryContext);
  systemPrompt = appendGoogleConnectionPrompt(systemPrompt, input.calendarService);
  systemPrompt = appendGroupPrompt(systemPrompt, input);
  systemPrompt = await appendIrisPrompt(systemPrompt, input.senderNumber, input.userMessage);
  return { sessionKey, systemPrompt };
}

function appendGoogleConnectionPrompt(systemPrompt: string, calendarService: CalendarService | null): string {
  if (!calendarService) {
    console.warn('[WhatsApp Agent] calendarService is null - Google APIs unavailable');
    return systemPrompt;
  }

  const conns = calendarService.getConnections();
  const googleConn = conns.find((conn: any) => conn.provider === 'google');
  console.log(`[WhatsApp Agent] Google connection state: ${googleConn ? `active=${googleConn.isActive}, email=${googleConn.email}` : 'NOT CONNECTED'}`);
  const hasGoogle = conns.some((conn: any) => conn.provider === 'google' && conn.isActive);
  if (hasGoogle) return systemPrompt;

  return `${systemPrompt}\n\n=== ESTADO DE CONEXION GOOGLE ===\nGoogle NO esta conectado. Si el usuario pide acciones de Calendar, Gmail, eventos o Drive, informale EXPRESAMENTE que debe conectar Google desde la interfaz de SofLIA Hub primero.\nPROHIBICIONES ESTRICTAS: NO INTENTES USAR las herramientas de computadora (use_computer, execute_command, open_application) NI el navegador (open_url) para entrar a leer sus correos o ver su calendario. Si no tienes la API de Google conectada, debes NEGARTE a revisar el calendario o correos y guiarlos a conectarse desde cero.`;
}

function appendGroupPrompt(systemPrompt: string, input: WhatsAppAgentPromptContextInput): string {
  if (!input.isGroup) return systemPrompt;
  return `${systemPrompt}\n\n=== CONTEXTO DE GRUPO ===
Estas respondiendo en un GRUPO de WhatsApp.
- Solo respondes cuando te mencionan, usan /soflia, o hacen reply a tu mensaje
- Se mas conciso que en conversaciones 1:1
- No ejecutes acciones destructivas - tus herramientas de sistema estan limitadas en grupos
- El participante que envio el mensaje es: ${input.senderNumber}
- Puedes usar: busquedas web, lectura de paginas, consultas IRIS, crear documentos, enviar archivos

HISTORIAL RECIENTE DEL GRUPO (PARA CONTEXTO):
${input.groupPassiveHistory || 'No hay mensajes previos en el bufer.'}
`;
}

async function appendIrisPrompt(systemPrompt: string, senderNumber: string, userMessage: string): Promise<string> {
  let session = getWhatsAppSession(senderNumber);
  if (!session && isIrisAvailable()) {
    try {
      const autoAuth = await tryAutoAuthByPhone(senderNumber);
      if (autoAuth.success && autoAuth.session) {
        session = autoAuth.session;
        console.log(`[WhatsApp Agent] Auto-auth success: ${session.fullName} (${session.email})`);
      }
    } catch (err) {
      console.error('[WhatsApp Agent] Auto-auth error:', err);
    }
  }

  if (session) {
    let nextPrompt = `${systemPrompt}\n\n=== SESION PROJECT HUB ===\nUsuario autenticado: ${session.fullName} (${session.email})\nUser ID: ${session.userId}\nEquipos: ${session.teamIds.length > 0 ? session.teamIds.join(', ') : 'ninguno encontrado'}\nPuede consultar sus tareas, proyectos y equipos directamente.\n${session.autoDetected ? 'Nota: El usuario fue identificado automaticamente por su numero de WhatsApp.' : ''}`;
    if (needsIrisData(userMessage)) {
      const irisContext = await buildIrisContextForWhatsApp(session.userId).catch((err) => {
        console.error('[WhatsApp Agent] Error fetching IRIS context:', err);
        return null;
      });
      if (irisContext) nextPrompt += `\n\n${irisContext}`;
    }
    return nextPrompt;
  }

  if (!isIrisAvailable()) return systemPrompt;
  return `${systemPrompt}\n\n=== PROJECT HUB ===\nEl sistema IRIS (Project Hub) esta disponible. El usuario NO ha iniciado sesion y su numero de WhatsApp no esta registrado en el sistema. Si pregunta por sus tareas, proyectos o equipos, indicale que debe autenticarse enviando su email y contrasena (o registrar su numero de telefono en su perfil de SofLIA Learning para acceso automatico).`;
}
