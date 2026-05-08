import type { Dispatch, SetStateAction } from 'react';
import type { TelegramStatusSnapshot } from '../../services/telegram-service';

export interface CalendarConnection {
  provider: 'google' | 'microsoft';
  email?: string;
  isActive: boolean;
}

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
}

export type ConnectionSection = 'whatsapp' | 'telegram' | 'google' | null;

export interface WhatsAppConnectionState {
  status: WhatsAppStatus;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface TelegramConnectionState {
  status: TelegramStatusSnapshot | null;
  tokenInput: string;
  testing: boolean;
  error: string | null;
  connected: boolean;
  setTokenInput: Dispatch<SetStateAction<string>>;
  saveToken: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggle: (enabled: boolean) => Promise<void>;
}

export interface CalendarConnectionsState {
  google: CalendarConnection | undefined;
  microsoft: CalendarConnection | undefined;
  loading: string | null;
  error: string | null;
  connect: (provider: 'google' | 'microsoft') => Promise<void>;
  disconnect: (provider: 'google' | 'microsoft') => Promise<void>;
}
