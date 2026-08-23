export interface ProjectHubWorkspace { id: string; name: string; slug: string; role: string; logoUrl?: string }
export interface ProjectHubSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  workspaces: ProjectHubWorkspace[];
}

export interface ProjectHubProject {
  project_id: string;
  workspace_id: string;
  project_key: string;
  project_name: string;
  project_description?: string | null;
  project_status: string;
  priority_level: string;
  health_status: string;
  completion_percentage: number;
  team_id?: string | null;
  updated_at: string;
  membership?: { project_role: string };
}

export interface ProjectHubEnvelope<T> {
  data: T;
  meta?: { correlation_id?: string; next_cursor?: string | null; has_more?: boolean };
  error?: { code: string; message: string; details?: unknown };
}

export interface ProjectHubResult<T = unknown> {
  success: boolean;
  data?: T;
  meta?: ProjectHubEnvelope<T>['meta'];
  error?: string;
  code?: string;
}

export interface ProjectHubRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  retry?: boolean;
}

