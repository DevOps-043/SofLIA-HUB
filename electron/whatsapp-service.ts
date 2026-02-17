/**
 * WhatsApp Service — Baileys-based WhatsApp Web connection for SofLIA Hub.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const logger = pino({ level: 'silent' });

const AUTH_DIR = path.join(app.getPath('userData'), 'whatsapp-auth');
const CONFIG_PATH = path.join(app.getPath('userData'), 'whatsapp-config.json');

interface WhatsAppConfig {
  allowedNumbers: string[];  // e.g. ['5215512345678']
  autoConnect: boolean;
}

async function loadConfig(): Promise<WhatsAppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { allowedNumbers: [], autoConnect: false };
  }
}

async function saveConfig(config: WhatsAppConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export class WhatsAppService extends EventEmitter {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig = { allowedNumbers: [], autoConnect: false };
  private connected = false;
  private qrDataUrl: string | null = null;
  private phoneNumber: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async init(): Promise<void> {
    this.config = await loadConfig();
  }

  async connect(): Promise<void> {
    if (this.sock) {
      this.emit('status', this.getStatus());
      return;
    }

    await fs.mkdir(AUTH_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });

    // ─── Connection events ─────────────────────────────────────
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          this.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          this.emit('qr', this.qrDataUrl);
          this.emit('status', this.getStatus());
        } catch (err) {
          console.error('[WhatsApp] QR generation error:', err);
        }
      }

      if (connection === 'open') {
        this.connected = true;
        this.qrDataUrl = null;
        this.reconnectAttempts = 0;
        this.phoneNumber = this.sock?.user?.id?.split(':')[0] || null;

        // Save auto-connect preference
        this.config.autoConnect = true;
        await saveConfig(this.config);

        this.emit('connected', this.phoneNumber);
        this.emit('status', this.getStatus());
        console.log('[WhatsApp] Connected:', this.phoneNumber);
      }

      if (connection === 'close') {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`[WhatsApp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
          this.sock = null;
          setTimeout(() => this.connect(), delay);
        } else {
          console.log('[WhatsApp] Disconnected permanently.');
          this.sock = null;
          if (statusCode === DisconnectReason.loggedOut) {
            // Clean auth state on logout
            await fs.rm(AUTH_DIR, { recursive: true, force: true });
            this.config.autoConnect = false;
            await saveConfig(this.config);
          }
        }
        this.emit('disconnected', statusCode);
        this.emit('status', this.getStatus());
      }
    });

    // Save credentials on update
    this.sock.ev.on('creds.update', saveCreds);

    // ─── Message handler ───────────────────────────────────────
    this.sock.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        // Ignore status broadcasts, own messages, and protocol messages
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;

        const jid = msg.key.remoteJid!;
        const senderNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');

        // Security: Check if number is in allowed list
        if (this.config.allowedNumbers.length > 0 && !this.config.allowedNumbers.includes(senderNumber)) {
          console.log(`[WhatsApp] Ignoring message from unauthorized number: ${senderNumber}`);
          continue;
        }

        // Extract text content
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.documentMessage?.caption ||
          '';

        if (!text.trim()) continue;

        this.emit('message', { jid, senderNumber, text: text.trim(), message: msg });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.connected = false;
      this.qrDataUrl = null;
      this.phoneNumber = null;
      this.config.autoConnect = false;
      await saveConfig(this.config);
      this.emit('status', this.getStatus());
    }
  }

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.sock || !this.connected) {
      throw new Error('WhatsApp no está conectado.');
    }

    // Split long messages (WhatsApp limit ~65536 chars but readability limit ~4000)
    const MAX_MSG_LENGTH = 4000;
    if (text.length <= MAX_MSG_LENGTH) {
      await this.sock.sendMessage(jid, { text });
    } else {
      const parts = [];
      for (let i = 0; i < text.length; i += MAX_MSG_LENGTH) {
        parts.push(text.slice(i, i + MAX_MSG_LENGTH));
      }
      for (const part of parts) {
        await this.sock.sendMessage(jid, { text: part });
        // Small delay between parts
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  async sendFile(jid: string, filePath: string, caption?: string): Promise<void> {
    if (!this.sock || !this.connected) {
      throw new Error('WhatsApp no está conectado.');
    }

    const resolvedPath = path.resolve(filePath);
    const stat = await fs.stat(resolvedPath);

    // WhatsApp file size limit (~16MB for documents, ~64MB for video)
    if (stat.size > 16 * 1024 * 1024) {
      throw new Error(`Archivo demasiado grande (${(stat.size / 1024 / 1024).toFixed(1)} MB). Máximo: 16 MB.`);
    }

    const buffer = await fs.readFile(resolvedPath);
    const fileName = path.basename(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();

    // Determine if image, video, or document
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const videoExts = ['.mp4', '.avi', '.mov', '.mkv'];

    if (imageExts.includes(ext)) {
      await this.sock.sendMessage(jid, {
        image: buffer,
        caption: caption || fileName,
        mimetype: `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`,
      });
    } else if (videoExts.includes(ext)) {
      await this.sock.sendMessage(jid, {
        video: buffer,
        caption: caption || fileName,
        mimetype: `video/${ext.slice(1)}`,
      });
    } else {
      // Send as document
      await this.sock.sendMessage(jid, {
        document: buffer,
        fileName,
        caption: caption || undefined,
        mimetype: 'application/octet-stream',
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): { connected: boolean; phoneNumber: string | null; qr: string | null; allowedNumbers: string[] } {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber,
      qr: this.qrDataUrl,
      allowedNumbers: this.config.allowedNumbers,
    };
  }

  async setAllowedNumbers(numbers: string[]): Promise<void> {
    this.config.allowedNumbers = numbers;
    await saveConfig(this.config);
  }

  async shouldAutoConnect(): Promise<boolean> {
    const config = await loadConfig();
    // Check if auth files exist
    try {
      await fs.access(AUTH_DIR);
      const files = await fs.readdir(AUTH_DIR);
      return config.autoConnect && files.length > 0;
    } catch {
      return false;
    }
  }
}
