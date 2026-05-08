export type ApiKeyProvider = 'google' | 'openai';
export type ApiProvider = ApiKeyProvider;

export interface ApiKeyRecord {
  id: string;
  user_id: string | null;
  provider: ApiKeyProvider;
  api_key: string;
  is_system_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyInput {
  provider: ApiKeyProvider;
  api_key: string;
}
