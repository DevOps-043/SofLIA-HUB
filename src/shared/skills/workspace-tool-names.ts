/**
 * Nombres de las herramientas de archivo acotadas al workspace de la Skill
 * activa. Viven en `shared` porque main las ejecuta y el renderer las declara
 * al modelo: un solo lugar evita que ambos lados diverjan en el nombre.
 *
 * No confundir con las herramientas de archivo generales
 * (`computer-file-tools.ts`), que operan sobre cualquier ruta del disco.
 * Estas solo existen mientras hay un workspace activo.
 */
export const SKILL_WORKSPACE_TOOL_NAMES = [
  'workspace_list_files',
  'workspace_read_file',
  'workspace_write_file',
  'workspace_edit_file',
  'workspace_generate_image',
  'workspace_download_image',
] as const;

export type SkillWorkspaceToolName = (typeof SKILL_WORKSPACE_TOOL_NAMES)[number];

export function isSkillWorkspaceToolName(name: string): name is SkillWorkspaceToolName {
  return (SKILL_WORKSPACE_TOOL_NAMES as readonly string[]).includes(name);
}
