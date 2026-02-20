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
  downloadMediaMessage,
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
  apiKey?: string;
  // ─── Group support (inspired by OpenClaw) ───
  allowedGroups: string[];       // JIDs of allowed groups (e.g. ['120363xxx@g.us']), empty = all groups allowed
  groupPolicy: 'open' | 'allowlist' | 'disabled';  // Who can invoke bot in groups
  groupAllowFrom: string[];      // Numbers allowed to invoke bot in groups (if policy=allowlist)
  groupActivation: 'mention' | 'always';  // How bot activates in groups
  groupPrefix: string;           // Command prefix for groups (default: '/soflia')
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  allowedNumbers: [],
  autoConnect: false,
  allowedGroups: [],
  groupPolicy: 'open',
  groupAllowFrom: [],
  groupActivation: 'mention',
  groupPrefix: '/soflia',
};

async function loadConfig(): Promise<WhatsAppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(config: WhatsAppConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export class WhatsAppService extends EventEmitter {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig = {
    allowedNumbers: [],
    autoConnect: false,
    allowedGroups: [],
    groupPolicy: 'open',
    groupAllowFrom: [],
    groupActivation: 'mention',
    groupPrefix: '/soflia',
  };
  private connected = false;
  private qrDataUrl: string | null = null;
  private phoneNumber: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // ─── Group context buffer (last 20 messages per group) ────────
  private groupContext = new Map<string, Array<{ sender: string; text: string; timestamp: number }>>();

  private addToGroupContext(jid: string, sender: string, text: string) {
    if (!this.groupContext.has(jid)) {
      this.groupContext.set(jid, []);
    }
    const history = this.groupContext.get(jid)!;
    history.push({ sender, text, timestamp: Date.now() });
    if (history.length > 20) history.shift();
  }

  private getGroupHistory(jid: string): string {
    const history = this.groupContext.get(jid) || [];
    if (history.length === 0) return '';
    return history
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender}: ${m.text}`)
      .join('\n');
  }

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

    // ─── Message handler (with group support) ─────────────────
    this.sock.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        // Ignore status broadcasts, own messages, and protocol messages
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;

        const jid = msg.key.remoteJid!;
        const isGroup = jid.endsWith('@g.us');
        let senderNumber = '';

        // ─── Extract sender: handle DM, Group, and LID ────────
        if (isGroup) {
          // In groups: real sender is in msg.key.participant, NOT remoteJid
          const participant = (msg.key.participant || msg.key.remoteJid || '').toString();
          senderNumber = participant
            .replace('@s.whatsapp.net', '')
            .replace(/@lid$/, '')
            .split(':')[0]; // Remove device suffix (e.g., "521551234:0")
        } else if (jid.endsWith('@lid')) {
          // LID (Linked Device ID) — try to resolve to real phone number
          try {
            const pn = await this.sock!.signalRepository?.lidMapping?.getPNForLID(jid);
            if (pn) {
              senderNumber = pn.split(':')[0].replace('@s.whatsapp.net', '').replace('@lid', '');
              console.log(`[WhatsApp] Resolved LID ${jid} → PN ${senderNumber}`);
            } else {
              const lidUser = jid.replace('@lid', '');
              console.warn(`[WhatsApp] Could not resolve LID ${jid}, using fallback: ${lidUser}`);
              senderNumber = lidUser;
            }
          } catch (err) {
            console.warn(`[WhatsApp] Error resolving LID ${jid}:`, err);
            senderNumber = jid.replace('@lid', '');
          }
        } else {
          // Standard DM: number@s.whatsapp.net
          senderNumber = jid.replace('@s.whatsapp.net', '');
        }

        // ─── Security: Group-level checks ─────────────────────
        if (isGroup) {
          // Check if groups are disabled entirely
          if (this.config.groupPolicy === 'disabled') {
            continue;
          }

          // Check if this specific group is allowed
          const allowedGroups = this.config.allowedGroups || [];
          if (allowedGroups.length > 0 && !allowedGroups.includes(jid)) {
            console.log(`[WhatsApp] Ignoring message from non-allowed group: ${jid}`);
            continue;
          }

          // Check if sender is allowed in groups (when policy=allowlist)
          const groupAllowFrom = this.config.groupAllowFrom || [];
          if (this.config.groupPolicy === 'allowlist' && groupAllowFrom.length > 0) {
            const senderAllowed = groupAllowFrom.some(allowed => {
              if (allowed === '*') return true;
              if (allowed === senderNumber) return true;
              const allowedDigits = allowed.replace(/\D/g, '').slice(-10);
              const senderDigits = senderNumber.replace(/\D/g, '').slice(-10);
              return allowedDigits === senderDigits && allowedDigits.length >= 10;
            });
            if (!senderAllowed) {
              console.log(`[WhatsApp] Ignoring group message from unauthorized sender: ${senderNumber}`);
              continue;
            }
          }

          // Check activation: should the bot respond to this message?
          if (!this.shouldRespondInGroup(msg)) {
            continue;
          }
        } else {
          // ─── Security: DM-level checks ─────────────────────
          const allowedNumbers = this.config.allowedNumbers || [];
          if (allowedNumbers.length > 0) {
            const senderDigits = senderNumber.replace(/\D/g, '');
            const isAllowed = allowedNumbers.some(allowed => {
              const allowedClean = allowed.replace(/\D/g, '').trim();
              // Exact match
              if (allowedClean === senderDigits) return true;
              // One contains the other (handles country code variations like 521 vs 52)
              if (senderDigits.endsWith(allowedClean) || allowedClean.endsWith(senderDigits)) return true;
              // Last 10 digits match (national number without country code)
              if (allowedClean.length >= 10 && senderDigits.length >= 10) {
                if (allowedClean.slice(-10) === senderDigits.slice(-10)) return true;
              }
              return false;
            });
            if (!isAllowed) {
              console.log(`[WhatsApp] Ignoring message from unauthorized number: ${senderNumber} (digits: ${senderDigits}) | Whitelist: [${allowedNumbers.join(', ')}] (JID: ${jid})`);
              continue;
            }
          }
        }

        // ─── Extract text content ─────────────────────────────
        const rawText =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.documentMessage?.caption ||
          '';

        // ─── Security & Activation ───────────────────────────
        const wasInvoked = isGroup ? this.shouldRespondInGroup(msg) : true;
        let cleanText = rawText.trim();

        if (isGroup) {
          const prefix = this.config.groupPrefix || '/soflia';
          if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
            cleanText = cleanText.slice(prefix.length).trim();
          }
          // Remove @botNumber mention from text
          const botNumber = this.sock?.user?.id?.split(':')[0] || '';
          if (botNumber) {
            cleanText = cleanText.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim();
          }
        }

        // Record in context buffer regardless of activation (for future queries)
        if (isGroup && cleanText) {
          this.addToGroupContext(jid, senderNumber, cleanText);
        }

        if (isGroup && !wasInvoked) continue;

        // If it was explicitly invoked but text is empty, let it pass
        if (!cleanText && !wasInvoked) continue;

        const history = isGroup ? this.getGroupHistory(jid) : '';

        // ─── Media Handling (Images, Docs, Video) ─────────────
        const mediaMsg = msg.message.imageMessage || msg.message.documentMessage || msg.message.videoMessage;
        if (mediaMsg) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
              logger,
              reuploadRequest: this.sock!.updateMediaMessage,
            });
            const fileName = (mediaMsg as any).fileName || (msg.message.imageMessage ? 'image.jpg' : 'file');
            const mimetype = mediaMsg.mimetype || 'application/octet-stream';

            this.emit('media', {
              jid,
              senderNumber,
              buffer: buffer as Buffer,
              fileName,
              mimetype,
              text: cleanText,
              isGroup,
              groupJid: isGroup ? jid : null,
              history,
              message: msg
            });
            continue;
          } catch (err) {
            console.error('[WhatsApp] Error downloading media:', err);
          }
        }

        // Check for audio/voice note
        const audioMsg = msg.message.audioMessage;
        if (audioMsg) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
              logger,
              reuploadRequest: this.sock!.updateMediaMessage,
            });
            this.emit('audio', {
              jid,
              senderNumber,
              buffer: buffer as Buffer,
              message: msg,
              isGroup,
              groupJid: isGroup ? jid : null,
              history
            });
          } catch (err) {
            console.error('[WhatsApp] Error downloading audio:', err);
          }
          continue;
        }

        if (!cleanText && !wasInvoked) continue;

        console.log(`[WhatsApp] ${isGroup ? 'GROUP' : 'DM'} from ${senderNumber}${isGroup ? ` in ${jid}` : ''}: ${cleanText.slice(0, 60)}`);

        this.emit('message', {
          jid,
          senderNumber,
          text: cleanText,
          message: msg,
          isGroup,
          groupJid: isGroup ? jid : null,
          history
        });
      }
    });
  }

  // ─── Group activation check (inspired by OpenClaw) ──────────
  private shouldRespondInGroup(msg: any): boolean {
    // Force strict mode for groups - ignores 'always' setting if it was stuck
    // if (activation === 'always') return true; 

    // Mention mode: check mention, prefix, or name
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';
    const lowerText = text.toLowerCase();

    // 1. Check native WhatsApp @mention (STRICT MATCH)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJids: string[] = contextInfo?.mentionedJid || [];
    const botJid = this.sock?.user?.id || '';
    const botNumber = botJid.split(':')[0];
    const botJidPlain = botNumber + '@s.whatsapp.net';
    
    const isMentioned = !!(botNumber && mentionedJids.some(
      (mjid: string) => mjid === botJidPlain || mjid.startsWith(botNumber + '@')
    ));

    // 2. Check command prefix
    const prefix = this.config.groupPrefix || '/soflia';
    const hasPrefix = lowerText.startsWith(prefix.toLowerCase());

    // 3. Check nickname with word boundaries (STRICT)
    const matchesPattern = /\bsoflia\b/i.test(lowerText);

    const result = !!(isMentioned || hasPrefix || matchesPattern);
    
    // Debug log for every group message to trace activation
    if (text) {
      console.log(`[WA-Group-Check] msg: "${text.slice(0, 30)}..." | trigger: ${result} (mention:${isMentioned}, prefix:${hasPrefix}, name:${matchesPattern})`);
    }

    return result;
  }

  // ─── Send reaction emoji to a message ───────────────────────
  async sendReaction(jid: string, msgKey: any, emoji: string): Promise<void> {
    try {
      if (this.sock && this.connected) {
        await this.sock.sendMessage(jid, {
          react: { text: emoji, key: msgKey },
        });
      }
    } catch (err) {
      // Reactions are non-critical, just log
      console.warn('[WhatsApp] Failed to send reaction:', err);
    }
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

  getStatus() {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber,
      qr: this.qrDataUrl,
      allowedNumbers: this.config.allowedNumbers,
      // Group config
      groupPolicy: this.config.groupPolicy,
      groupActivation: this.config.groupActivation,
      groupPrefix: this.config.groupPrefix,
      allowedGroups: this.config.allowedGroups,
      groupAllowFrom: this.config.groupAllowFrom,
    };
  }

  isAllowedNumber(number: string): boolean {
    if (!this.config.allowedNumbers || this.config.allowedNumbers.length === 0) return true;
    const numberDigits = number.replace(/\D/g, '');
    return this.config.allowedNumbers.some(allowed => {
      const allowedDigits = allowed.replace(/\D/g, '').trim();
      if (allowedDigits === numberDigits) return true;
      if (numberDigits.endsWith(allowedDigits) || allowedDigits.endsWith(numberDigits)) return true;
      if (allowedDigits.length >= 10 && numberDigits.length >= 10) {
        if (allowedDigits.slice(-10) === numberDigits.slice(-10)) return true;
      }
      return false;
    });
  }

  // ─── Bot identity (for agent mention detection) ─────────────
  getBotNumber(): string {
    return this.sock?.user?.id?.split(':')[0] || '';
  }

  async setAllowedNumbers(numbers: string[]): Promise<void> {
    this.config.allowedNumbers = numbers;
    await saveConfig(this.config);
  }

  // ─── Group config setters ──────────────────────────────────
  async setGroupConfig(config: {
    groupPolicy?: 'open' | 'allowlist' | 'disabled';
    groupActivation?: 'mention' | 'always';
    groupPrefix?: string;
    allowedGroups?: string[];
    groupAllowFrom?: string[];
  }): Promise<void> {
    if (config.groupPolicy !== undefined) this.config.groupPolicy = config.groupPolicy;
    if (config.groupActivation !== undefined) this.config.groupActivation = config.groupActivation;
    if (config.groupPrefix !== undefined) this.config.groupPrefix = config.groupPrefix;
    if (config.allowedGroups !== undefined) this.config.allowedGroups = config.allowedGroups;
    if (config.groupAllowFrom !== undefined) this.config.groupAllowFrom = config.groupAllowFrom;
    await saveConfig(this.config);
  }

  async saveApiKey(apiKey: string): Promise<void> {
    this.config.apiKey = apiKey;
    await saveConfig(this.config);
  }

  async getSavedApiKey(): Promise<string | undefined> {
    const config = await loadConfig();
    return config.apiKey;
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
