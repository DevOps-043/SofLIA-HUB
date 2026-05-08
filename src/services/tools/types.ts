export type ToolCategory =
  | 'desarrollo'
  | 'marketing'
  | 'educacion'
  | 'productividad'
  | 'creatividad'
  | 'analisis'
  | 'documentos'
  | 'diagramas'
  | 'comunicacion';

export interface UserTool {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  category: ToolCategory | null;
  system_prompt: string;
  starter_prompts: string[];
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserToolInput {
  name: string;
  description?: string;
  icon?: string;
  category?: ToolCategory;
  system_prompt: string;
  starter_prompts?: string[];
}

export const TOOL_CATEGORIES: { value: ToolCategory; label: string; icon: string }[] = [
  { value: 'desarrollo', label: 'Desarrollo', icon: '\u{1F4BB}' },
  { value: 'marketing', label: 'Marketing', icon: '\u{1F4E3}' },
  { value: 'educacion', label: 'Educacion', icon: '\u{1F393}' },
  { value: 'productividad', label: 'Productividad', icon: '\u{1F4CB}' },
  { value: 'creatividad', label: 'Creatividad', icon: '\u{1F3A8}' },
  { value: 'analisis', label: 'Analisis', icon: '\u{1F4CA}' },
  { value: 'documentos', label: 'Documentos', icon: '\u{1F4C4}' },
  { value: 'diagramas', label: 'Diagramas', icon: '\u{1F500}' },
  { value: 'comunicacion', label: 'Comunicacion', icon: '\u2709\uFE0F' },
];
