import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';
import si from 'systeminformation';
// @ts-ignore
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { WASocket } from '@whiskeysockets/baileys';

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

                    const text = msg.message.conversation || 
                                 msg.message.extendedTextMessage?.text || '';
                                 
                    if (!text) continue;

                    await this.processIncomingText(text, jid, msg.key.id);
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

    private async processIncomingText(text: string, jid: string, messageId?: string | null) {
        const textLower = text.toLowerCase().trim();

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
