import { supabase } from '../../lib/supabase';
import {
  isSkillCategory,
  type CreateUserSkillInput,
  type UpdateUserSkillInput,
  type UserSkill,
} from '../../shared/skills/types';
import { toSkillCommand } from './slash-commands';

/**
 * Persistencia de las Skills del USUARIO sobre `public.skills` (instancia
 * LIA). El aislamiento real lo aplica RLS por `auth.uid()`; los filtros de
 * este modulo son una segunda barrera, no la principal.
 *
 * Las Skills del SISTEMA no viven aqui: se declaran en codigo
 * (`src/shared/skills/registry.ts`) para que la frontera de privilegio no
 * dependa de una fila escribible.
 */

interface SkillRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  command: string | null;
  category: string | null;
  instructions: string;
  starter_prompts: unknown;
  is_favorite: boolean | null;
  usage_count: number | null;
  created_at: string;
  updated_at: string;
}

const SKILL_COLUMNS =
  'id, user_id, name, description, icon, command, category, instructions, starter_prompts, is_favorite, usage_count, created_at, updated_at';

/**
 * Mapea una fila a `UserSkill`. La clase se fija aqui a 'usuario' de forma
 * literal: aunque la fila trajera una columna que dijera otra cosa, jamas
 * puede presentarse como Skill del sistema.
 */
/**
 * El comando se guarda ya normalizado, pero se vuelve a normalizar al leer
 * para que una fila escrita por una version anterior no rompa la invocacion.
 */
function normalizeCommand(value: string | null | undefined): string | null {
  return toSkillCommand(String(value ?? '').replace(/^\/+/, '')) || null;
}

function toUserSkill(row: SkillRow): UserSkill {
  return {
    skillClass: 'usuario',
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon?.trim() || 'herramienta',
    command: normalizeCommand(row.command),
    category: isSkillCategory(row.category) ? row.category : null,
    instructions: row.instructions,
    starterPrompts: normalizeStarterPrompts(row.starter_prompts),
    isFavorite: Boolean(row.is_favorite),
    usageCount: row.usage_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeStarterPrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Skills del usuario autenticado. Sin sesion devuelve una lista vacia: el
 * catalogo anonimo solo puede contener Skills del sistema.
 */
export async function listUserSkills(): Promise<UserSkill[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_COLUMNS)
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[SkillsService] Error al listar skills:', error);
    throw error;
  }

  return (data ?? []).map((row) => toUserSkill(row as SkillRow));
}

export async function createUserSkill(input: CreateUserSkillInput): Promise<UserSkill> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Debes iniciar sesion para crear skills');

  const payload = validateInput(input);

  const { data, error } = await supabase
    .from('skills')
    .insert({
      user_id: userId,
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
      command: payload.command,
      category: payload.category,
      instructions: payload.instructions,
      starter_prompts: payload.starterPrompts,
    })
    .select(SKILL_COLUMNS)
    .single();

  if (error) {
    console.error('[SkillsService] Error al crear skill:', error);
    throw error;
  }

  return toUserSkill(data as SkillRow);
}

export async function updateUserSkill(id: string, updates: UpdateUserSkillInput): Promise<UserSkill> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = requireText(updates.name, 'El nombre de la skill es obligatorio.');
  if (updates.instructions !== undefined) {
    patch.instructions = requireText(updates.instructions, 'Las instrucciones de la skill son obligatorias.');
  }
  if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
  if (updates.icon !== undefined) patch.icon = updates.icon?.trim() || 'herramienta';
  if (updates.command !== undefined) patch.command = normalizeCommand(updates.command);
  if (updates.category !== undefined) patch.category = updates.category ?? null;
  if (updates.starterPrompts !== undefined) patch.starter_prompts = normalizeStarterPrompts(updates.starterPrompts);
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('skills')
    .update(patch)
    .eq('id', id)
    .select(SKILL_COLUMNS)
    .single();

  if (error) {
    console.error('[SkillsService] Error al actualizar skill:', error);
    throw error;
  }

  return toUserSkill(data as SkillRow);
}

export async function deleteUserSkill(id: string): Promise<void> {
  const { error } = await supabase.from('skills').delete().eq('id', id);
  if (error) {
    console.error('[SkillsService] Error al eliminar skill:', error);
    throw error;
  }
}

/** Registra el uso de una Skill del usuario. No bloquea el turno si falla. */
export async function markUserSkillUsed(id: string, currentCount: number): Promise<void> {
  const { error } = await supabase
    .from('skills')
    .update({ usage_count: currentCount + 1, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('[SkillsService] No se pudo registrar el uso de la skill:', error.message);
}

function validateInput(input: CreateUserSkillInput) {
  return {
    name: requireText(input.name, 'El nombre de la skill es obligatorio.'),
    instructions: requireText(input.instructions, 'Las instrucciones de la skill son obligatorias.'),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || 'herramienta',
    command: normalizeCommand(input.command),
    category: input.category ?? null,
    starterPrompts: normalizeStarterPrompts(input.starterPrompts),
  };
}

function requireText(value: string | undefined, message: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(message);
  return text;
}
