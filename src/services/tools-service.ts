/**
 * Tools Service - CRUD for user_tools in Lia Supabase
 */

import { supabase } from '../lib/supabase';

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
  { value: 'desarrollo', label: 'Desarrollo', icon: '💻' },
  { value: 'marketing', label: 'Marketing', icon: '📣' },
  { value: 'educacion', label: 'Educación', icon: '🎓' },
  { value: 'productividad', label: 'Productividad', icon: '📋' },
  { value: 'creatividad', label: 'Creatividad', icon: '🎨' },
  { value: 'analisis', label: 'Análisis', icon: '📊' },
  { value: 'documentos', label: 'Documentos', icon: '📄' },
  { value: 'diagramas', label: 'Diagramas', icon: '🔀' },
  { value: 'comunicacion', label: 'Comunicación', icon: '✉️' },
];

export async function getUserTools(): Promise<UserTool[]> {
  const { data, error } = await supabase
    .from('user_tools')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching user tools:', error);
    throw error;
  }

  return data || [];
}

export async function createUserTool(tool: CreateUserToolInput): Promise<UserTool> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Debes iniciar sesión para crear herramientas');
  }

  const { data, error } = await supabase
    .from('user_tools')
    .insert({
      user_id: user.id,
      name: tool.name,
      description: tool.description || null,
      icon: tool.icon || '⚙️',
      category: tool.category || null,
      system_prompt: tool.system_prompt,
      starter_prompts: tool.starter_prompts || [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user tool:', error);
    throw error;
  }

  return data;
}

export async function updateUserTool(id: string, updates: Partial<CreateUserToolInput>): Promise<UserTool> {
  const { data, error } = await supabase
    .from('user_tools')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user tool:', error);
    throw error;
  }

  return data;
}

export async function deleteUserTool(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_tools')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user tool:', error);
    throw error;
  }
}
