/**
 * Clientes Supabase (IRIS y SOFIA) — único punto de creación.
 *
 * Carga `.env` desde la raíz del proyecto al primer uso. Memoiza ambos
 * clientes para evitar re-instanciación en cada llamada. Si las credenciales
 * faltan, devuelve `null` y deja que el caller decida qué hacer.
 */

import { app } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createMainSupabaseClient } from '../supabase-client-factory';

const envPath = path.join(app.getAppPath(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const IRIS_URL = process.env.VITE_IRIS_SUPABASE_URL || '';
const IRIS_KEY = process.env.VITE_IRIS_SUPABASE_ANON_KEY || '';
const SOFIA_URL = process.env.VITE_SOFIA_SUPABASE_URL || '';
const SOFIA_KEY = process.env.VITE_SOFIA_SUPABASE_ANON_KEY || '';

let irisSupa: SupabaseClient | null = null;
let sofiaSupa: SupabaseClient | null = null;

export function getIrisClient(): SupabaseClient | null {
  if (irisSupa) return irisSupa;
  if (!IRIS_URL || !IRIS_KEY) {
    console.warn('[IRIS-Main] No IRIS credentials found in env');
    return null;
  }
  const result = createMainSupabaseClient({
    url: IRIS_URL,
    key: IRIS_KEY,
    serviceName: 'IRIS-Main',
  });
  if (!result.client) {
    console.error(`[IRIS-Main] ${result.error || 'No se pudo crear el cliente.'}`);
    return null;
  }
  irisSupa = result.client;
  return irisSupa;
}

export function getSofiaClient(): SupabaseClient | null {
  if (sofiaSupa) return sofiaSupa;
  if (!SOFIA_URL || !SOFIA_KEY) {
    console.warn('[SOFIA-Main] No SOFIA credentials found in env');
    return null;
  }
  const result = createMainSupabaseClient({
    url: SOFIA_URL,
    key: SOFIA_KEY,
    serviceName: 'SOFIA-Main',
    // Las consultas de organizaciones, reuniones y WhatsApp se ejecutan con la
    // identidad SOFIA publicada por el renderer. La persistencia sigue fuera
    // del SDK y cifrada en `main/sofia-session-store.ts`.
    withUserSession: true,
  });
  if (!result.client) {
    console.error(`[SOFIA-Main] ${result.error || 'No se pudo crear el cliente.'}`);
    return null;
  }
  sofiaSupa = result.client;
  return sofiaSupa;
}

export function isIrisAvailable(): boolean {
  return !!getIrisClient();
}

/**
 * Credenciales de SOFIA para clientes efimeros (ej. verificacion de contraseña
 * via Supabase Auth sin contaminar la sesion del cliente memoizado).
 */
export function getSofiaCredentials(): { url: string; key: string } | null {
  if (!SOFIA_URL || !SOFIA_KEY) return null;
  return { url: SOFIA_URL, key: SOFIA_KEY };
}
