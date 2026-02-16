import { supabase } from '../lib/supabase';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export async function loadFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading folders:', error);
    return [];
  }
  return data || [];
}

export async function createFolder(
  userId: string,
  name: string
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    return null;
  }
  return data;
}

export async function renameFolder(
  folderId: string,
  name: string
): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .update({ name: name.trim() })
    .eq('id', folderId);

  if (error) {
    console.error('Error renaming folder:', error);
    return false;
  }
  return true;
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('Error deleting folder:', error);
    return false;
  }
  return true;
}

export async function moveChatToFolder(
  conversationId: string,
  folderId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('conversations')
    .update({ folder_id: folderId })
    .eq('id', conversationId);

  if (error) {
    console.error('Error moving chat to folder:', error);
    return false;
  }
  return true;
}
