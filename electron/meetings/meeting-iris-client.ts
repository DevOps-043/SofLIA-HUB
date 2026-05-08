import { app } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createMainSupabaseClient } from '../supabase-client-factory';

let envLoaded = false;
let irisClient: SupabaseClient | null = null;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  const envPath = path.join(app.getAppPath(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export function getMeetingIrisClient(): SupabaseClient {
  ensureEnvLoaded();

  if (irisClient) {
    return irisClient;
  }

  const irisUrl = process.env.VITE_IRIS_SUPABASE_URL || '';
  const irisKey = process.env.VITE_IRIS_SUPABASE_ANON_KEY || '';
  if (!irisUrl || !irisKey) {
    throw new Error('Faltan las credenciales de IRIS Supabase para Meeting Ops.');
  }

  const result = createMainSupabaseClient({
    url: irisUrl,
    key: irisKey,
    serviceName: 'MeetingOps-IRIS',
  });
  if (!result.client) {
    throw new Error(result.error || 'No pude crear el cliente IRIS para Meeting Ops.');
  }

  irisClient = result.client;
  return irisClient;
}
