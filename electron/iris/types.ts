/**
 * Tipos de dominio del paquete IRIS.
 * Sin lógica — solo contratos.
 */

export interface IrisTeam {
  team_id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  owner_id: string;
}

export interface IrisProject {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description?: string;
  project_status: string;
  health_status: string;
  priority_level: string;
  completion_percentage: number;
  team_id?: string;
  lead_user_id?: string;
  start_date?: string;
  target_date?: string;
}

export interface IrisIssue {
  issue_id: string;
  team_id: string;
  issue_number: number;
  title: string;
  description?: string;
  status_id: string;
  priority_id?: string;
  project_id?: string;
  assignee_id?: string;
  creator_id: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  status?: { name: string; status_type: string; color?: string };
  priority?: { name: string; level: number; color?: string };
}

export interface IrisTeamMember {
  member_id: string;
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface IrisTeamMemberDetail extends IrisTeamMember {
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

export type IrisStatusRecord = {
  status_id: string;
  name: string;
  status_type: string;
  color?: string;
  position: number;
  is_default: boolean;
  is_closed?: boolean;
};

export type IrisPriorityRecord = {
  priority_id: string;
  name: string;
  level: number;
  color: string;
};

export interface WhatsAppSession {
  phoneNumber: string;
  userId: string;
  email: string;
  fullName: string;
  username: string;
  authenticatedAt: string;
  teamIds: string[];
  /** true = matched by phone, false = manual login */
  autoDetected: boolean;
}

/**
 * Resultado tipado de operaciones de resolución (refs humanas → entidad IRIS).
 * El warnings array transporta avisos no fatales (p.ej. "se usó equipo único por defecto").
 */
export type ResolveResult<T> =
  | { success: true; value: T; warnings: string[] }
  | { success: false; error: string };
