/**
 * Clientes Supabase (IRIS y SOFIA) — único punto de creación.
 *
 * Carga `.env` desde la raíz del proyecto al primer uso. Memoiza ambos
 * clientes para evitar re-instanciación en cada llamada. Si las credenciales
 * faltan, devuelve `null` y deja que el caller decida qué hacer.
 */

import { app } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

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

const SUPABASE_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
};

export function getIrisClient(): SupabaseClient | null {
  if (irisSupa) return irisSupa;
  if (!IRIS_URL || !IRIS_KEY) {
    console.warn('[IRIS-Main] No IRIS credentials found in env');
    return null;
  }
  try {
    irisSupa = createClient(IRIS_URL, IRIS_KEY, SUPABASE_OPTIONS);
    return irisSupa;
  } catch (err) {
    console.error('[IRIS-Main] Failed to create client:', err);
    return null;
  }
}

export function getSofiaClient(): SupabaseClient | null {
  if (sofiaSupa) return sofiaSupa;
  if (!SOFIA_URL || !SOFIA_KEY) {
    console.warn('[SOFIA-Main] No SOFIA credentials found in env');
    return null;
  }
  try {
    sofiaSupa = createClient(SOFIA_URL, SOFIA_KEY, SUPABASE_OPTIONS);
    return sofiaSupa;
  } catch (err) {
    console.error('[SOFIA-Main] Failed to create client:', err);
    return null;
  }
}

export function isIrisAvailable(): boolean {
  return !!getIrisClient();
}
