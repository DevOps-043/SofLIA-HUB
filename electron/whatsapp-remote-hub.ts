import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';
import { createRequire } from 'node:module';

// systeminformation: CJS module loaded via require() to avoid ESM↔CJS interop crash
const _require = createRequire(import.meta.url);
const si = _require('systeminformation');
// @ts-ignore
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import os from 'os';

const execAsync = promisify(exec);

// ==========================================
// 1. Zod Sandbox Gatekeeper
// ==========================================

const blockedRegexes = [
  /(rm\s+-rf|del\s+\/|format\s+)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /chmod\s+-R\s+777/i,
  /chown\s+-R\s+/i,
  /sudo\s+rm/i,
  />\s*\/dev\/sd/i
];

export const CommandInputSchema = z.object({
  text: z.string().min(1).refine(
    (val) => {
      for (const regex of blockedRegexes) {
        if (regex.test(val)) return false;
      }
      return true;
    },
    { message: "Comando bloqueado: Patrón peligroso detectado." }
  ),
  jid: z.string(),
  messageId: z.string().optional()
});

export type CommandInput = z.infer<typeof CommandInputSchema>;

export class SandboxGatekeeper {
  static validate(input: unknown) {
    return CommandInputSchema.safeParse(input);
  }
}

// ==========================================
// 1.5 Quick-Conversion Utilities
// ==========================================

class WhatsAppFileConverter {
    static async convertTextToPDF(inputPath: string): Promise<Buffer> {
        let textContent = '';
        try {
            textContent = fs.readFileSync(inputPath, 'utf8');
        } catch {
            textContent = 'No se pudo leer el contenido del archivo de texto.';
        }
        
        // Escape characters for basic PDF compatibility
        const cleanText = textContent
            .replace(/[()\\]/g, '\\$&') 
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
            .substring(0, 2000); // Limit to 2000 chars for this simple PDF generator
            
        // Minimal PDF 1.4 template structure
        const pdfContent = `%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n5 0 obj\n<</Length ${44 + cleanText.length}>>\nstream\nBT\n/F1 12 Tf\n10 700 Td\n(${cleanText}) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n0000000274 00000 n \ntrailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${274 + 44 + cleanText.length}\n%%EOF`;
        
        return Buffer.from(pdfContent, 'utf8');
    }

    static async summarizeText(inputPath: string): Promise<string> {
        try {
            const textContent = fs.readFileSync(inputPath, 'utf8');
            const lines = textContent.split('\n').filter((l: string) => l.trim().length > 0);
            if (lines.length === 0) return "El documento está vacío o no contiene texto legible.";
            
            const charCount = textContent.length;
            const wordCount = textContent.split(/\s+/).filter((w: string) => w.length > 0).length;
            
            return `*📝 Resumen Rápido:*\n\n` +
                   `- *Líneas con contenido:* ${lines.length}\n` +
                   `- *Total de Palabras:* ${wordCount}\n` +
                   `- *Total de Caracteres:* ${charCount}\n\n` +
                   `*Muestra del contenido:*\n_"${lines[0].substring(0, 150)}${lines[0].length > 150 ? '...' : ''}"_`;
        } catch {
            return "❌ No se pudo analizar el documento. Verifica que sea un archivo de texto válido.";
        }
    }
}

interface PendingConversion {
    id: string;
    jid: string;
    filePath: string;
    fileName: string;
    timestamp: number;
}

// ==========================================
// 2. WhatsApp Remote Hub
// ==========================================

interface PendingCommand {
    id: string;
    command: string;
    jid: string;
    messageId?: string;
    timestamp: number;
}

export class WhatsAppRemoteHub {
    private socket: WASocket | null = null;
    private mainWindow: BrowserWindow | null = null;
    private pendingApprovals: Map<string, PendingCommand> = new Map();
    private pendingConversions: Map<string, PendingConversion> = new Map();

    constructor() {}

    /**
     * Inicializa el hub remoto de control y monitorización.
     * @param socket Instancia del socket WASocket de Baileys
     * @param mainWindow Ventana principal de Electron para comunicación IPC
     */
    public init(socket: WASocket, mainWindow: BrowserWindow) {
        this.socket = socket;
        this.mainWindow = mainWindow;

        this.setupListeners();
        this.setupIPC();
        console.log('[WhatsAppRemoteHub] Inicializado correctamente.');
    }

    private setupListeners() {
        if (!this.socket) return;

        this.socket.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;
                
                for (const msg of m.messages) {
                    if (!msg.message || msg.key.fromMe) continue;

                    const jid = msg.key.remoteJid;
                    if (!jid) continue;

                    const isDocumentType = (msg: WAMessage) => !!(msg.message?.documentMessage || (msg.message as any)?.documentWithCaptionMessage?.message?.documentMessage);
                    const hasMedia = isDocumentType(msg) || !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage);

                    // Rutear documentos entrantes hacia Quick-Conversion
                    if (hasMedia && isDocumentType(msg)) {
                        await this.handleIncomingDocument(msg, jid);
                        continue;
                    }

                    const text = msg.message?.conversation || 
                                 msg.message?.extendedTextMessage?.text || '';
                                 
                    if (!text) continue;

                    await this.processIncomingText(text, jid, msg.key.id, msg);
                }
            } catch (error) {
                console.error('[WhatsAppRemoteHub] Error procesando mensaje:', error);
            }
        });
    }

    private setupIPC() {
        ipcMain.on('security-alert-response', async (_event, data: { commandId: string, approved: boolean }) => {
            const { commandId, approved } = data;
            const pending = this.pendingApprovals.get(commandId);
            
            if (!pending) return;
            this.pendingApprovals.delete(commandId);

            if (approved) {
                await this.sendMessage(pending.jid, `✅ Ejecución aprobada en el escritorio. Ejecutando...`);
                await this.executeSystemCommand(pending.command, pending.jid);
            } else {
                await this.sendMessage(pending.jid, `❌ Ejecución denegada en el escritorio.`);
            }
        });
    }

    private async handleIncomingDocument(msg: WAMessage, jid: string) {
        try {
            if (!this.socket) return;
            const docMessage = msg.message?.documentMessage || (msg.message as any)?.documentWithCaptionMessage?.message?.documentMessage;
            if (!docMessage) return;

            const fileName = docMessage.fileName || 'documento.txt';
            const mimetype = docMessage.mimetype || '';

            // Validar si es un tipo de texto soportado
            const validTextMimes = ['text/plain', 'application/json', 'text/csv', 'application/javascript'];
            if (!validTextMimes.includes(mimetype) && !fileName.endsWith('.txt') && !fileName.endsWith('.md')) {
                await this.sendMessage(jid, `📄 *Documento Recibido:*\n_${fileName}_\n\n_(Nota: Por ahora Quick-Conversion solo soporta archivos de texto puro para generar PDF o resumir)_`);
                return;
            }

            await this.sendMessage(jid, `⏳ Descargando documento \`${fileName}\` para Quick-Conversion...`);

            // Descargar el adjunto de WhatsApp
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const tempPath = path.join(os.tmpdir(), `wa_doc_${Date.now()}_${fileName}`);
            fs.writeFileSync(tempPath, buffer as Buffer);

            // Guardar estado pendiente
            const pendingId = `conv_${Date.now()}`;
            this.pendingConversions.set(jid, {
                id: pendingId,
                jid,
                filePath: tempPath,
                fileName,
                timestamp: Date.now()
            });

            // Enviar mensaje interactivo o texto de confirmación
            const menuText = `📄 *Documento Procesado:*\n_${fileName}_\n\n¿Qué instrucciones deseas ejecutar (Quick-Conversion)?\n\nResponde con uno de estos comandos:\n👉 *Generar PDF*\n👉 *Resumir*`;
            
            await this.sendMessage(jid, menuText);

        } catch (error: any) {
            console.error('[WhatsAppRemoteHub] Error al manejar documento:', error);
            await this.sendMessage(jid, `❌ Error al procesar el documento: ${error.message}`);
        }
    }

    private async handleQuickConversion(command: string, pending: PendingConversion, jid: string, msg?: WAMessage) {
        try {
            await this.sendMessage(jid, `⚙️ Ejecutando \`${command}\` sobre ${pending.fileName}...`);

            if (command === 'generar pdf') {
                const pdfBuffer = await WhatsAppFileConverter.convertTextToPDF(pending.filePath);
                if (this.socket) {
                    await this.socket.sendMessage(jid, {
                        document: pdfBuffer,
                        mimetype: 'application/pdf',
                        fileName: pending.fileName.replace(/\.[^/.]+$/, "") + ".pdf"
                    }, { quoted: msg });
                }
            } else if (command === 'resumir') {
                const summary = await WhatsAppFileConverter.summarizeText(pending.filePath);
                await this.sendMessage(jid, summary);
            }

            // Limpieza
            if (fs.existsSync(pending.filePath)) {
                fs.unlinkSync(pending.filePath);
            }
        } catch (error: any) {
            console.error('[WhatsAppRemoteHub] Error en Quick-Conversion:', error);
            await this.sendMessage(jid, `❌ Error durante la conversión: ${error.message}`);
        }
    }

    private async processIncomingText(text: string, jid: string, messageId?: string | null, msg?: WAMessage) {
        const textLower = text.toLowerCase().trim();
        const textUpper = text.toUpperCase().trim();

        // 0. Quick-Conversion Responses
        if (textLower === 'generar pdf' || textLower === 'resumir') {
            const pending = this.pendingConversions.get(jid);
            if (pending) {
                await this.handleQuickConversion(textLower, pending, jid, msg);
                this.pendingConversions.delete(jid);
                return;
            }
        }

        // 0. Comando: Bloqueo de Emergencia Inmediato
        if (textUpper === 'BLOQUEAR' || textUpper === '!BLOQUEAR') {
            try {
                const platform = os.platform();
                if (platform === 'win32') {
                    execSync('rundll32.exe user32.dll,LockWorkStation');
                } else if (platform === 'darwin') {
                    execSync('pmset displaysleepnow');
                } else {
                    execSync('loginctl lock-session || xdg-screensaver lock');
                }
                await this.sendMessage(jid, '🔒 *PC Bloqueado* de forma inmediata e incondicional.');
            } catch (error: any) {
                console.error('[WhatsAppRemoteHub] Error al bloquear PC:', error);
                await this.sendMessage(jid, `❌ Error al bloquear el PC: ${error.message}`);
            }
            return;
        }

        // 1. Comando: Estado del sistema
        if (textLower === 'estado del sistema' || textLower === '!estado') {
            const status = await this.getSystemStatus();
            await this.sendMessage(jid, status);
            return;
        }

        // 2. Comando: Enviar archivo / directorio comprimido al vuelo
        if (textLower.startsWith('enviar archivo ') || textLower.startsWith('!enviar ')) {
            const filePath = text.replace(/^(enviar archivo |!enviar )/i, '').trim();
            await this.handleSendFile(jid, filePath);
            return;
        }

        // 3. Comando: Ejecutar (Sistema)
        if (textLower.startsWith('ejecutar ') || textLower.startsWith('!exec ')) {
            const command = text.replace(/^(ejecutar |!exec )/i, '').trim();
            await this.handleCommandExecutionRequest(command, jid, messageId || undefined);
            return;
        }
    }

    private async handleCommandExecutionRequest(command: string, jid: string, messageId?: string) {
        // Validar con Sandbox Gatekeeper
        const validationResult = SandboxGatekeeper.validate({ text: command, jid, messageId });
        
        if (!validationResult.success) {
            const errorMessage = validationResult.error.errors[0]?.message || 'Comando bloqueado por seguridad.';
            console.warn(`[SandboxGatekeeper] Bloqueo proactivo: ${command}`);
            await this.sendMessage(jid, `🚨 *ALERTA DE SEGURIDAD*\n\n${errorMessage}`);
            
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('security-alert', {
                    type: 'BLOCKED',
                    command,
                    jid,
                    reason: errorMessage,
                    timestamp: Date.now()
                });
            }
            return;
        }

        // Si pasa el regex, igual se requiere aprobación explícita en desktop
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        this.pendingApprovals.set(commandId, {
            id: commandId,
            command,
            jid,
            messageId,
            timestamp: Date.now()
        });

        await this.sendMessage(jid, `⏳ *Aprobación Requerida*\n\nEl comando \`${command}\` está retenido. Esperando aprobación explícita en el escritorio.`);

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('security-alert', {
                type: 'APPROVAL_REQUIRED',
                commandId,
                command,
                jid,
                timestamp: Date.now()
            });
        }
    }

    private async executeSystemCommand(command: string, jid: string) {
        try {
            const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
            let response = `💻 *Resultado de Ejecución:*\n\n`;
            
            if (stdout) {
                response += `*Output:*\n\`\`\`\n${stdout.substring(0, 1000)}${stdout.length > 1000 ? '\n...[truncado]' : ''}\n\`\`\`\n`;
            }
            if (stderr) {
                response += `*Errores:*\n\`\`\`\n${stderr.substring(0, 500)}\n\`\`\``;
            }
            
            if (!stdout && !stderr) {
                response += `(Comando ejecutado sin salida)`;
            }

            await this.sendMessage(jid, response);
        } catch (error: any) {
            await this.sendMessage(jid, `❌ *Error al ejecutar:*\n\`\`\`\n${error.message}\n\`\`\``);
        }
    }

    private async handleSendFile(jid: string, targetPath: string) {
        try {
            const normalizedPath = path.resolve(targetPath);
            
            if (!fs.existsSync(normalizedPath)) {
                await this.sendMessage(jid, `❌ La ruta especificada no existe:\n${normalizedPath}`);
                return;
            }

            await this.sendMessage(jid, `📦 Comprimiendo archivo/directorio...\nDependiendo del tamaño, esto puede tomar unos momentos.`);

            const buffer = await this.compressPathToBuffer(normalizedPath);
            const fileName = path.basename(normalizedPath) + '.zip';

            if (!this.socket) throw new Error('Socket no inicializado');

            await this.socket.sendMessage(jid, {
                document: buffer,
                mimetype: 'application/zip',
                fileName: fileName
            });
            
            console.log(`[WhatsAppRemoteHub] Archivo enviado: ${fileName}`);

        } catch (error: any) {
            console.error('[WhatsAppRemoteHub] Error al enviar archivo:', error);
            await this.sendMessage(jid, `❌ Error al comprimir o enviar el archivo: ${error.message}`);
        }
    }

    private async compressPathToBuffer(targetPath: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            const chunks: Buffer[] = [];

            archive.on('data', (chunk: Buffer) => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', (err: any) => reject(err));

            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                archive.directory(targetPath, false);
            } else {
                archive.file(targetPath, { name: path.basename(targetPath) });
            }

            archive.finalize();
        });
    }

    private async getSystemStatus(): Promise<string> {
        try {
            const [cpu, mem, temp] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.cpuTemperature()
            ]);

            const cpuLoad = cpu.currentLoad.toFixed(2);
            const memFreeGB = (mem.free / (1024 * 1024 * 1024)).toFixed(2);
            const memTotalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(2);
            const temperature = temp.main && temp.main > 0 ? `${temp.main}°C` : 'N/A';

            return `📊 *Estado del Sistema*\n\n` +
                   `💻 *CPU:* ${cpuLoad}%\n` +
                   `🧠 *Memoria Libre:* ${memFreeGB} GB / ${memTotalGB} GB\n` +
                   `🌡️ *Temperatura:* ${temperature}`;
        } catch (error: any) {
            console.error('[WhatsAppRemoteHub] Error al obtener estado:', error);
            return `❌ Error al obtener el estado del sistema: ${error.message}`;
        }
    }

    private async sendMessage(jid: string, text: string) {
        if (!this.socket) {
            console.error('[WhatsAppRemoteHub] No socket to send message');
            return;
        }
        try {
            await this.socket.sendMessage(jid, { text });
        } catch (err) {
            console.error('[WhatsAppRemoteHub] Error enviando mensaje:', err);
        }
    }
}

export const remoteHub = new WhatsAppRemoteHub();
