import { createClient } from '@supabase/supabase-js';
import { IRIS_SUPABASE } from '../config';

// localStorage adapter for Electron desktop
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

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const irisUrl = isValidUrl(IRIS_SUPABASE.URL) ? IRIS_SUPABASE.URL : '';
const irisKey = IRIS_SUPABASE.ANON_KEY || '';

export const irisSupa = irisUrl && irisKey
  ? createClient(irisUrl, irisKey, {
      auth: {
        storage: localStorageAdapter,
        storageKey: 'iris-auth-token',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isIrisConfigured = () => {
  return IRIS_SUPABASE.URL !== '' && IRIS_SUPABASE.ANON_KEY !== '' && isValidUrl(IRIS_SUPABASE.URL);
};

// ============================================
// IRIS Types
// ============================================

export interface IrisTeam {
  team_id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  color?: string;
  status: 'active' | 'archived' | 'suspended';
  visibility: 'public' | 'private' | 'internal';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface IrisProject {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description?: string;
  icon_name?: string;
  icon_color?: string;
  cover_image_url?: string;
  project_status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
  health_status: 'on_track' | 'at_risk' | 'off_track' | 'none';
  priority_level: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  completion_percentage: number;
  start_date?: string;
  target_date?: string;
  actual_end_date?: string;
  team_id?: string;
  lead_user_id?: string;
  created_by_user_id: string;
  is_public: boolean;
  is_template: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface IrisIssue {
  issue_id: string;
  team_id: string;
  issue_number: number;
  title: string;
  description?: string;
  description_html?: string;
  status_id: string;
  priority_id?: string;
  project_id?: string;
  cycle_id?: string;
  parent_issue_id?: string;
  assignee_id?: string;
  creator_id: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  estimate_points?: number;
  estimate_hours?: number;
  time_spent_minutes?: number;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  // Joined fields
  status?: IrisStatus;
  priority?: IrisPriority;
}

export interface IrisStatus {
  status_id: string;
  team_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status_type: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
  position: number;
  is_default: boolean;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface IrisPriority {
  priority_id: string;
  name: string;
  level: number;
  color: string;
  icon?: string;
  created_at: string;
}
