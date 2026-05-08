import type { BrowserWindow } from 'electron';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { handleIncomingDocument } from './whatsapp-remote-hub/document-handler';
import { setupRemoteHubIPC } from './whatsapp-remote-hub/ipc';
import { setupRemoteHubListeners } from './whatsapp-remote-hub/listeners';
import { sendWhatsAppTextMessage } from './whatsapp-remote-hub/messages';
import { processIncomingText } from './whatsapp-remote-hub/text-router';
import type { PendingCommand, PendingConversion } from './whatsapp-remote-hub/types';

export { CommandInputSchema, SandboxGatekeeper } from './whatsapp-remote-hub/sandbox';
export type { CommandInput } from './whatsapp-remote-hub/sandbox';

export class WhatsAppRemoteHub {
  private socket: WASocket | null = null;
  private mainWindow: BrowserWindow | null = null;
  private pendingApprovals: Map<string, PendingCommand> = new Map();
  private pendingConversions: Map<string, PendingConversion> = new Map();

  public init(socket: WASocket, mainWindow: BrowserWindow): void {
    this.socket = socket;
    this.mainWindow = mainWindow;
    this.setupListeners();
    this.setupIPC();
    console.log('[WhatsAppRemoteHub] Inicializado correctamente.');
  }

  private setupListeners(): void {
    setupRemoteHubListeners({
      socket: this.socket,
      handleIncomingDocument: (message, jid) => this.handleDocument(message, jid),
      processIncomingText: (text, jid, messageId, message) => this.processText(text, jid, messageId, message),
    });
  }

  private setupIPC(): void {
    setupRemoteHubIPC({
      pendingApprovals: this.pendingApprovals,
      sendMessage: (jid, text) => this.sendMessage(jid, text),
    });
  }

  private async handleDocument(message: WAMessage, jid: string): Promise<void> {
    await handleIncomingDocument({
      socket: this.socket,
      message,
      jid,
      pendingConversions: this.pendingConversions,
      sendMessage: (targetJid, text) => this.sendMessage(targetJid, text),
    });
  }

  private async processText(text: string, jid: string, messageId?: string | null, message?: WAMessage): Promise<void> {
    await processIncomingText({
      socket: this.socket,
      mainWindow: this.mainWindow,
      text,
      jid,
      messageId,
      message,
      pendingConversions: this.pendingConversions,
      pendingApprovals: this.pendingApprovals,
      sendMessage: (targetJid, messageText) => this.sendMessage(targetJid, messageText),
    });
  }

  private async sendMessage(jid: string, text: string): Promise<void> {
    await sendWhatsAppTextMessage(this.socket, jid, text);
  }
}

export const remoteHub = new WhatsAppRemoteHub();
