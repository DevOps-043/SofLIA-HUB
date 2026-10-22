/** Persistencia propia de Soflia Hub en Lia. */
import { app } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createMainSupabaseClient } from './supabase-client-factory';

let envLoaded = false;
let hubClient: SupabaseClient | null = null;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  const envPath = path.join(app.getAppPath(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export function getHubDbClient(): SupabaseClient {
  ensureEnvLoaded();

  if (hubClient) {
    return hubClient;
  }

  const hubUrl = process.env.VITE_SUPABASE_URL || '';
  const hubKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!hubUrl || !hubKey) {
    throw new Error('Faltan las credenciales de la base de datos de Soflia Hub (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const result = createMainSupabaseClient({
    url: hubUrl,
    key: hubKey,
    serviceName: 'HubDB',
    // Este cliente lleva la sesion del usuario (ver `main/hub-session.ts`): sin
    // ella su rol es `anon`, `auth.uid()` es NULL y las tablas con RLS por
    // identidad le devuelven cero filas sin error.
    withUserSession: true,
  });
  if (!result.client) {
    throw new Error(result.error || 'No pude crear el cliente de la base de Soflia Hub.');
  }

  hubClient = result.client;
  return hubClient;
}
