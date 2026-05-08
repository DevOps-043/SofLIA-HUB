import path from 'node:path';
import fs from 'node:fs';
import { USERS_DIR, defaultUserProfile } from './constants';
import { readFileContent, sanitizePhone } from './file-helpers';
import { appendToSection } from './memory-writes';

export function updateKnowledgeUserProfile(
  phoneNumber: string,
  section: string,
  content: string,
): { success: boolean; message: string } {
  try {
    const userFile = getUserProfilePath(phoneNumber);
    const currentContent = fs.existsSync(userFile)
      ? fs.readFileSync(userFile, 'utf-8')
      : defaultUserProfile(phoneNumber);

    fs.writeFileSync(userFile, appendToSection(currentContent, section, content), 'utf-8');
    console.log(`[KnowledgeService] User profile updated for ${phoneNumber}: [${section}] ${content.slice(0, 40)}`);
    return { success: true, message: 'Perfil actualizado.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function getUserProfileContent(phoneNumber: string): string | null {
  return readFileContent(getUserProfilePath(phoneNumber));
}

function getUserProfilePath(phoneNumber: string): string {
  return path.join(USERS_DIR, `${sanitizePhone(phoneNumber)}.md`);
}
