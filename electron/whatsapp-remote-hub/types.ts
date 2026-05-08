import type { BrowserWindow } from 'electron';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';

export interface PendingConversion {
  id: string;
  jid: string;
  filePath: string;
  fileName: string;
  timestamp: number;
}

export interface PendingCommand {
  id: string;
  command: string;
  jid: string;
  messageId?: string;
  timestamp: number;
}

export type SendTextMessage = (jid: string, text: string) => Promise<void>;

export interface RemoteHubRuntime {
  socket: WASocket | null;
  mainWindow: BrowserWindow | null;
  sendMessage: SendTextMessage;
}

export interface IncomingTextOptions extends RemoteHubRuntime {
  text: string;
  jid: string;
  messageId?: string | null;
  message?: WAMessage;
  pendingConversions: Map<string, PendingConversion>;
  pendingApprovals: Map<string, PendingCommand>;
}
