import type { SupabaseClient } from '@supabase/supabase-js';
import { app } from 'electron';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createMainSupabaseClient } from '../supabase-client-factory';

let envLoaded = false;
let liaClient: SupabaseClient | null = null;
let sofiaClient: SupabaseClient | null = null;

function pickDesktopSupabaseKey(serviceRoleKey: string, anonKey: string, serviceName: string): string {
  if (serviceRoleKey && process.env.SOFLIA_ALLOW_DESKTOP_SERVICE_ROLE === 'true') {
    console.warn(
      `[AppChatService] ${serviceName} usa service role por opt-in explicito. No habilitar en builds distribuidos.`,
    );
    return serviceRoleKey;
  }

  if (serviceRoleKey) {
    console.warn(
      `[AppChatService] ${serviceName} ignoro SERVICE_ROLE_KEY en desktop. Usa RPC/RLS para acceso multiusuario.`,
    );
  }

  return anonKey;
}

function ensureEnvLoaded(): void {
  if (envLoaded) {
    return;
  }

  try {
    const envPath = path.join(app.getAppPath(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } catch (error) {
    console.warn('[AppChatService] No pude cargar .env:', error);
  }

  envLoaded = true;
}

export function getLiaClient(): SupabaseClient | null {
  if (liaClient) {
    return liaClient;
  }

  ensureEnvLoaded();

  const url = process.env.VITE_SUPABASE_URL || '';
  const key = pickDesktopSupabaseKey(
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    process.env.VITE_SUPABASE_ANON_KEY || '',
    'Lia',
  );

  if (!url || !key) {
    console.warn('[AppChatService] Lia no esta configurado en el entorno.');
    return null;
  }

  const result = createMainSupabaseClient({
    url,
    key,
    serviceName: 'AppChat-Lia',
  });
  if (!result.client) {
    console.warn(`[AppChatService] ${result.error || 'No pude crear el cliente Lia.'}`);
    return null;
  }

  liaClient = result.client;
  return liaClient;
}

export function getSofiaClient(): SupabaseClient | null {
  if (sofiaClient) {
    return sofiaClient;
  }

  ensureEnvLoaded();

  const url = process.env.VITE_SOFIA_SUPABASE_URL || '';
  const key = pickDesktopSupabaseKey(
    process.env.SOFIA_SERVICE_ROLE_KEY || '',
    process.env.VITE_SOFIA_SUPABASE_ANON_KEY || '',
    'SOFIA',
  );

  if (!url || !key) {
    return null;
  }

  const result = createMainSupabaseClient({
    url,
    key,
    serviceName: 'AppChat-SOFIA',
  });
  if (!result.client) {
    console.warn(`[AppChatService] ${result.error || 'No pude crear el cliente SOFIA.'}`);
    return null;
  }

  sofiaClient = result.client;
  return sofiaClient;
}
