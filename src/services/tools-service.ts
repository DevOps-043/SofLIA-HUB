import { supabase } from '../lib/supabase';
import type { CreateUserToolInput, UserTool } from './tools/types';

export { TOOL_CATEGORIES } from './tools/types';
export type { CreateUserToolInput, ToolCategory, UserTool } from './tools/types';

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
    throw new Error('Debes iniciar sesion para crear herramientas');
  }

  const { data, error } = await supabase
    .from('user_tools')
    .insert({
      user_id: user.id,
      name: tool.name,
      description: tool.description || null,
      icon: tool.icon || '\u2699\uFE0F',
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
