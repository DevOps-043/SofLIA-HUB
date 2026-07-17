/**
 * Cliente generico a la BASE DE DATOS DE SOFLIA HUB (VITE_SUPABASE_URL)
 * para el proceso main.
 *
 * Regla de arquitectura: lo operativo del Hub (meetings, estado de workflows,
 * tareas programadas) vive en la base del Hub. IRIS es el producto compartido
 * y solo RECIBE informacion aprobada via iris-data-main. Las bases no se mezclan.
 */
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
    throw new Error('Faltan las credenciales de la base de datos de SofLIA Hub (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const result = createMainSupabaseClient({
    url: hubUrl,
    key: hubKey,
    serviceName: 'HubDB',
  });
  if (!result.client) {
    throw new Error(result.error || 'No pude crear el cliente de la base de SofLIA Hub.');
  }

  hubClient = result.client;
  return hubClient;
}
