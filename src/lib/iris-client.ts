import { IRIS_SUPABASE } from '../config';
import { createElectronSupabaseClient, isValidUrl } from './supabase-factory';

export const irisSupa = createElectronSupabaseClient(
  IRIS_SUPABASE.URL,
  IRIS_SUPABASE.ANON_KEY,
  'iris-auth-token',
);

export const isIrisConfigured = () => {
  return IRIS_SUPABASE.URL !== '' && IRIS_SUPABASE.ANON_KEY !== '' && isValidUrl(IRIS_SUPABASE.URL);
};

export type { IrisIssue, IrisPriority, IrisProject, IrisStatus, IrisTeam } from './iris-types';
