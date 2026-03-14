import { SUPABASE } from '../config';
import { createElectronSupabaseClient, isValidUrl } from './supabase-factory';

const supabaseUrl = isValidUrl(SUPABASE.URL) ? SUPABASE.URL : 'https://placeholder-project.supabase.co';
const supabaseKey = SUPABASE.ANON_KEY || 'placeholder-key';

if (!isValidUrl(SUPABASE.URL)) {
  console.warn('Supabase URL is missing or invalid. Check your .env file.');
}

export const supabase = createElectronSupabaseClient(supabaseUrl, supabaseKey)!;

export const isSupabaseConfigured = () => {
  return SUPABASE.URL !== '' && SUPABASE.ANON_KEY !== '' && isValidUrl(SUPABASE.URL);
};
