import type { SystemSkill } from './types';
import { AUDIOVISUAL_PROMPT } from '../../prompts/skills/audiovisual';

export const AUDIOVISUAL_SKILL: SystemSkill = {
  skillClass: 'sistema', id: 'sistema:audiovisual', name: 'Producción audiovisual', command: 'video',
  description: 'Crea videos conceptuales con escenas editables, continuidad visual, audio sintético y exportación MP4 verificada.', icon: 'presentacion', category: 'creatividad',
  instructions: AUDIOVISUAL_PROMPT, starterPrompts: ['Crea un video de 30 segundos para explicar este producto'], surfaces: ['chat'],
  tools: ['workspace_list_files', 'workspace_read_file', 'workspace_write_file', 'workspace_edit_file', 'workspace_render_video'],
  workspace: { rootFolder: 'audiovisual', allowedExtensions: ['.json', '.md'], maxFileBytes: 512 * 1024, maxWorkspaceBytes: 128 * 1024 * 1024, entryFile: 'film.json', protectedFiles: ['vista.html', 'salida/video.mp4', 'qa/informe.json'] },
  featureFlag: 'VITE_SKILL_AUDIOVISUAL_ENABLED', enabledByDefault: true, blockedInGroups: true,
};
