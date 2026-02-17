/**
 * WhatsApp Agent — Main-process Gemini agentic loop for WhatsApp messages.
 * Uses executeToolDirect() to call computer-use tools without IPC.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeToolDirect } from './computer-use-handlers';
import type { WhatsAppService } from './whatsapp-service';

// ─── Tool definitions for WhatsApp (safe subset) ──────────────────
const BLOCKED_TOOLS_WA = new Set([
  'execute_command',
  'open_application',
  'open_url',
  'take_screenshot',
]);

const CONFIRM_TOOLS_WA = new Set([
  'delete_item',
  'send_email',
]);

// Tool declarations for Gemini (filtered for WhatsApp security)
const WA_TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
          show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee y devuelve el contenido de un archivo de texto. Máximo 1MB.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo con contenido de texto.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
          content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
        required: ['path'],
      },
    },
    {
      name: 'move_item',
      description: 'Mueve o renombra un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
          destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
          destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envía un archivo o carpeta a la papelera. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene información de un archivo: tamaño, fechas, tipo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos por nombre en un directorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
          pattern: { type: 'STRING' as const, description: 'Patrón de texto a buscar.' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene información del sistema: SO, CPU, RAM, disco.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el portapapeles.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { text: { type: 'STRING' as const, description: 'Texto a copiar.' } },
        required: ['text'],
      },
    },
    {
      name: 'get_email_config',
      description: 'Verifica si el email está configurado.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'configure_email',
      description: 'Configura el email (solo email + contraseña de aplicación). Solo una vez.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          email: { type: 'STRING' as const, description: 'Email del usuario.' },
          password: { type: 'STRING' as const, description: 'Contraseña de aplicación.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envía un email. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Destinatario.' },
          subject: { type: 'STRING' as const, description: 'Asunto.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas de archivos adjuntos.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'whatsapp_send_file',
      description: 'Envía un archivo de la computadora al usuario directamente por WhatsApp. Usa esto cuando el usuario pida que le envíes un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a enviar.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo.' },
        },
        required: ['file_path'],
      },
    },
  ],
};

const WA_SYSTEM_PROMPT = `Eres SOFLIA, un asistente de productividad inteligente. El usuario te está hablando desde WhatsApp y tú tienes acceso a su computadora de escritorio que está encendida.

## Tus Capacidades:
- Puedes navegar, buscar, leer, crear, mover, copiar y eliminar archivos y carpetas
- Puedes enviar emails con archivos adjuntos
- Puedes enviar archivos de la computadora al usuario por WhatsApp usando whatsapp_send_file
- Puedes leer y escribir en el portapapeles
- Puedes obtener información del sistema

## RESTRICCIONES DE SEGURIDAD:
- NO puedes ejecutar comandos en la terminal (bloqueado por seguridad)
- NO puedes abrir aplicaciones ni URLs (no hay pantalla visible)
- NO puedes tomar capturas de pantalla

## REGLAS:
1. Responde en español a menos que te pidan otro idioma
2. Sé conciso — los mensajes de WhatsApp deben ser breves y claros
3. Para acciones destructivas (eliminar archivos, enviar emails), SIEMPRE pide confirmación primero. Pregunta "¿Confirmas que quiero [acción]? Responde SI para proceder."
4. Si el usuario pide un archivo, usa whatsapp_send_file para enviárselo directamente por WhatsApp
5. Si el usuario pide buscar algo, usa search_files y muestra los resultados de forma legible
6. Usa get_system_info si necesitas saber rutas del usuario (como el escritorio)
7. Completa las tareas ÍNTEGRAMENTE — no dejes pasos para el usuario
8. No uses formato markdown complejo — usa texto simple con emojis para organizar`;

// ─── Conversation history per number ────────────────────────────────
const MAX_HISTORY = 20;
const conversations = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();

// ─── Pending confirmations ──────────────────────────────────────────
interface PendingConfirmation {
  toolName: string;
  args: Record<string, any>;
  resolve: (confirmed: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingConfirmations = new Map<string, PendingConfirmation>();

export class WhatsAppAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private waService: WhatsAppService;
  private apiKey: string;

  constructor(waService: WhatsAppService, apiKey: string) {
    this.waService = waService;
    this.apiKey = apiKey;
  }

  updateApiKey(key: string) {
    this.apiKey = key;
    this.genAI = null;
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  async handleMessage(jid: string, senderNumber: string, text: string): Promise<void> {
    // Check for pending confirmation response
    const pending = pendingConfirmations.get(senderNumber);
    if (pending) {
      const lower = text.toLowerCase().trim();
      const confirmed = lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(senderNumber);
      pending.resolve(confirmed);
      return;
    }

    try {
      // Send "typing" indicator
      await this.waService.sendText(jid, '...');

      const response = await this.runAgentLoop(jid, senderNumber, text);

      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Error:', err);
      await this.waService.sendText(jid, `Error: ${err.message}`);
    }
  }

  private async runAgentLoop(jid: string, senderNumber: string, userMessage: string): Promise<string> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: WA_SYSTEM_PROMPT,
      tools: [WA_TOOL_DECLARATIONS as any],
    });

    // Get or create conversation history
    if (!conversations.has(senderNumber)) {
      conversations.set(senderNumber, []);
    }
    const history = conversations.get(senderNumber)!;

    const chatSession = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 4096 },
    });

    let response = await chatSession.sendMessage(userMessage);
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const candidate = response.response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // Final text response
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const finalText = textParts.join('');

        // Update conversation history
        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: finalText }] });

        // Trim history
        while (history.length > MAX_HISTORY * 2) {
          history.shift();
        }
        // Ensure starts with user
        while (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }

        return finalText;
      }

      // Execute function calls
      const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

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

        // Handle whatsapp_send_file specially
        if (toolName === 'whatsapp_send_file') {
          try {
            await this.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, message: `Archivo enviado por WhatsApp: ${toolArgs.file_path}` },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, error: err.message },
              },
            });
          }
          continue;
        }

        // Confirmation for dangerous tools
        if (CONFIRM_TOOLS_WA.has(toolName)) {
          const desc = toolName === 'delete_item'
            ? `Eliminar: ${toolArgs.path}`
            : `Enviar email a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`;

          const confirmed = await this.requestConfirmation(jid, senderNumber, toolName, desc, toolArgs);

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

        // Execute the tool
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

      // Send function responses back to model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    return 'He completado las acciones solicitadas.';
  }

  private async requestConfirmation(
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, any>
  ): Promise<boolean> {
    const emoji = toolName === 'delete_item' ? '🗑️' : '📧';
    await this.waService.sendText(
      jid,
      `${emoji} *Confirmación requerida*\n\n${description}\n\n¿Confirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`
    );

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(senderNumber);
        resolve(false);
        this.waService.sendText(jid, 'Tiempo de confirmación agotado. Acción cancelada.');
      }, 60000); // 1 minute timeout

      pendingConfirmations.set(senderNumber, { toolName, args, resolve, timeout });
    });
  }
}
