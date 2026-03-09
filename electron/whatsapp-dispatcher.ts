import type { WAMessage, AnyMessageContent } from '@whiskeysockets/baileys';
import { EventEmitter } from 'node:events';

/**
 * Gateway unificado para WhatsApp con soporte de Rate Limiting y
 * Menú interactivo básico para proteger contra bloqueos (429) y
 * enrutar comandos esenciales.
 */
export class WhatsAppDispatcher extends EventEmitter {
  private static instance: WhatsAppDispatcher;
  private messageQueue = new Map<string, AnyMessageContent[]>();
  private sock: any = null;
  private isProcessing = false;
  private baseDelay = 1000;
  private maxDelay = 32000;

  private constructor() {
    super();
  }

  public static getInstance(): WhatsAppDispatcher {
    if (!WhatsAppDispatcher.instance) {
      WhatsAppDispatcher.instance = new WhatsAppDispatcher();
    }
    return WhatsAppDispatcher.instance;
  }

  public setSocket(socket: any): void {
    this.sock = socket;
  }

  public getQueueSize(): number {
    let size = 0;
    for (const messages of this.messageQueue.values()) {
      size += messages.length;
    }
    return size;
  }

  public clearQueue(): void {
    this.messageQueue.clear();
    this.baseDelay = 1000;
  }

  public enqueueMessage = async (jid: string, content: AnyMessageContent): Promise<void> => {
    if (!this.messageQueue.has(jid)) {
      this.messageQueue.set(jid, []);
    }
    this.messageQueue.get(jid)!.push(content);
    
    if (!this.isProcessing) {
      // Usamos setTimeout para evitar bloqueos del event loop y dar tiempo a agrupar
      setTimeout(() => this.processQueue(), 100);
    }
  };

  private processQueue = async (): Promise<void> => {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const [jid, messages] of this.messageQueue.entries()) {
        while (messages.length > 0) {
          const content = messages[0]; // Extraemos sin remover para reintentos
          
          try {
            if (this.sock) {
              await this.sock.sendMessage(jid, content);
            } else {
              console.warn('[WhatsAppDispatcher] Socket not set, message dropped');
            }
            
            // Eliminamos el mensaje de la cola al enviarse exitosamente
            messages.shift();
            
            // Restablecemos el backoff a su base si el envío fue exitoso
            this.baseDelay = 1000;
            
            // Retraso artificial entre mensajes para evitar baneos por spam
            if (messages.length > 0) {
               await new Promise(resolve => setTimeout(resolve, this.baseDelay));
            }
          } catch (error: any) {
            console.error(`[WhatsAppDispatcher] Error al enviar mensaje a ${jid}:`, error);
            
            // Detección de Rate Limiting (Error 429 Too Many Requests)
            const isRateLimit = error?.output?.statusCode === 429 || 
                               error?.data === 429 || 
                               error?.message?.includes('429');
                               
            if (isRateLimit) {
              console.warn(`[WhatsAppDispatcher] Rate limit detectado (429). Iniciando backoff exponencial...`);
              this.baseDelay = Math.min(this.baseDelay * 2, this.maxDelay);
              console.log(`[WhatsAppDispatcher] Pausando envíos por ${this.baseDelay}ms`);
              
              // Emitimos evento por si otros servicios quieren reaccionar al rate limit
              this.emit('rate_limit', { delay: this.baseDelay, jid });
              
              // Salimos de la función inmediatamente, el bloque finally reprogramará la ejecución futura
              return;
            } else {
              // Si no es un error de rate limit, descartamos el mensaje corrupto
              console.warn(`[WhatsAppDispatcher] Descartando mensaje fallido para ${jid}`);
              messages.shift();
            }
          }
        }
        
        // Limpiar la clave del Map si no quedan mensajes para este jid
        if (messages.length === 0) {
          this.messageQueue.delete(jid);
        }
      }
    } finally {
      this.isProcessing = false;
      
      // Si todavía hay mensajes en la cola (por backoff), reprogramamos
      if (this.messageQueue.size > 0) {
        setTimeout(() => this.processQueue(), this.baseDelay);
      }
    }
  };

  public handleIncomingCommand = async (msg: WAMessage): Promise<void> => {
    if (!msg.message || !msg.key.remoteJid || msg.key.fromMe) return;

    // Extraer texto del mensaje en diferentes formatos posibles
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption || '';
                 
    if (!text) return;

    const jid = msg.key.remoteJid;
    const command = text.trim().toLowerCase();

    // Implementación del Menú Principal Interactivo
    if (command === '/menu' || command === 'menu') {
      const menuText = `*🤖 SofLIA Hub - Menú Principal*\n\n` +
        `Selecciona una opción enviando el número:\n\n` +
        `1️⃣ *📁 Archivos* - Explorar y gestionar\n` +
        `2️⃣ *🤖 IA Autodev* - Programación autónoma\n` +
        `3️⃣ *🖥️ Control PC* - Control remoto\n` +
        `4️⃣ *📊 Reportes* - Estado del sistema\n\n` +
        `_Escribe el número de la opción para continuar._`;

      await this.enqueueMessage(jid, { text: menuText });
      return;
    }

    // Respuesta automática para las opciones del menú
    if (['1', '2', '3', '4'].includes(command)) {
      let response = '';
      switch (command) {
        case '1':
          response = `*📁 Gestión de Archivos*\n\nComandos disponibles:\n- \`/archivos listar [ruta]\`\n- \`/archivos buscar [nombre]\`\n- \`/archivos leer [archivo]\``;
          break;
        case '2':
          response = `*🤖 IA Autodev (Self-Coding)*\n\nComienza enviando tu requerimiento:\n\`/autodev crea una herramienta para [tu idea]\``;
          break;
        case '3':
          response = `*🖥️ Control de PC Remoto*\n\nComandos rápidos:\n- \`/captura\` (Tomar y enviar screenshot)\n- \`/bloquear\` (Bloquear pantalla Windows)\n- \`/procesos\` (Ver procesos de alto consumo)\n- \`/click\` / \`/teclado\` para RPA`;
          break;
        case '4':
          response = `*📊 Reportes del Sistema*\n\nPide un informe completo del estado con:\n\`/reporte sistema\``;
          break;
      }
      await this.enqueueMessage(jid, { text: response });
      return;
    }
  };
}

export const whatsappDispatcher = WhatsAppDispatcher.getInstance();
