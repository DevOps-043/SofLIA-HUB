import { readFileContent, truncate } from './file-helpers';
import {
  BOOTSTRAP_MAX_CHARS,
  BOOTSTRAP_TOTAL_MAX_CHARS,
  MEMORY_FILE,
  PATHS_FILE,
} from './constants';

type UserProfileReader = (phoneNumber: string) => string | null;

export function getBootstrapKnowledgeContext(phoneNumber: string, readUserProfile: UserProfileReader): string {
  const builder = new BootstrapContextBuilder();
  builder.add('BASE DE CONOCIMIENTO PERSISTENTE', readFileContent(MEMORY_FILE), BOOTSTRAP_MAX_CHARS);
  builder.add('PERFIL DEL USUARIO', readUserProfile(phoneNumber), BOOTSTRAP_MAX_CHARS);
  builder.add('MAPA DE RUTAS DEL SISTEMA', readFileContent(PATHS_FILE), 5000);
  return builder.toString();
}

class BootstrapContextBuilder {
  private totalChars = 0;
  private sections = '';

  add(title: string, content: string | null, maxChars: number): void {
    if (this.totalChars >= BOOTSTRAP_TOTAL_MAX_CHARS) return;
    if (!content || content.trim().length <= 50) return;

    const remaining = BOOTSTRAP_TOTAL_MAX_CHARS - this.totalChars;
    const truncated = truncate(content, Math.min(maxChars, remaining));
    this.sections += `\n\n═══ ${title} ═══\n${truncated}`;
    this.totalChars += truncated.length;
  }

  toString(): string {
    return this.sections;
  }
}
