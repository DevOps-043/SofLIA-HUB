import { createClient } from '@supabase/supabase-js';
import { SOFIA_SUPABASE } from '../config';

// Storage adapter using localStorage (Electron desktop)
const localStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  },
};

// Validate URL helper
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// SOFIA Supabase Client (Auth Principal + Organizaciones/Equipos)
const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
const sofiaKey = SOFIA_SUPABASE.ANON_KEY || '';

export const sofiaSupa = sofiaUrl && sofiaKey
  ? createClient(sofiaUrl, sofiaKey, {
      auth: {
        storage: localStorageAdapter,
        storageKey: 'sofia-auth-token',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isSofiaConfigured = () => {
  return (
    SOFIA_SUPABASE.URL !== '' &&
    SOFIA_SUPABASE.ANON_KEY !== '' &&
    isValidUrl(SOFIA_SUPABASE.URL)
  );
};

// ============================================
// SOFIA Types
// ============================================

export interface SofiaUser {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  profile_picture_url?: string;
  cargo_rol?: 'Usuario' | 'Instructor' | 'Administrador' | 'Business' | 'Business User';
  phone?: string;
  bio?: string;
  location?: string;
  created_at: string;
}

export interface SofiaOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  contact_email?: string;
  subscription_plan?: 'team' | 'business' | 'enterprise';
  subscription_status?: 'active' | 'expired' | 'cancelled' | 'trial' | 'pending';
  brand_color_primary?: string;
  brand_color_secondary?: string;
  is_active: boolean;
  created_at: string;
}

export interface SofiaOrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'suspended' | 'removed';
  job_title?: string;
  team_id?: string;
  zone_id?: string;
  region_id?: string;
  joined_at?: string;
  organization?: SofiaOrganization;
  team?: SofiaTeam;
}

export interface SofiaTeam {
  id: string;
  organization_id: string;
  zone_id: string;
  name: string;
  description?: string;
  code?: string;
  is_active: boolean;
}

export interface SofiaUserProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  cargo_rol?: string;
  organizations: SofiaOrganization[];
  teams: SofiaTeam[];
  memberships: SofiaOrganizationUser[];
}
