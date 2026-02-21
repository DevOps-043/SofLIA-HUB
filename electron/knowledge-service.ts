/**
 * KnowledgeService — OpenClaw-style .md file-based persistent knowledge system.
 *
 * Architecture (inspired by OpenClaw):
 *  - MEMORY.md          → Long-term curated memory (decisions, preferences, durable facts). Always injected.
 *  - users/{phone}.md   → Per-user profile (name, preferences, context). Always injected for that user.
 *  - memory/YYYY-MM-DD.md → Daily append-only logs. NOT injected — accessed on-demand via search/read tools.
 *
 * The agent reads and writes these files actively. Knowledge files are plain Markdown,
 * human-readable, and always available without embeddings or thresholds.
 *
 * Runs in the Electron main process.
 */
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// ─── Constants ───────────────────────────────────────────────────────
const KNOWLEDGE_DIR = path.join(app.getPath('userData'), 'knowledge');
const USERS_DIR = path.join(KNOWLEDGE_DIR, 'users');
const DAILY_DIR = path.join(KNOWLEDGE_DIR, 'memory');
const MEMORY_FILE = path.join(KNOWLEDGE_DIR, 'MEMORY.md');
const BOOTSTRAP_MAX_CHARS = 15000; // Max chars per bootstrap file injected into prompt
const BOOTSTRAP_TOTAL_MAX_CHARS = 25000; // Total max across all bootstrap files

// ─── Default MEMORY.md template ─────────────────────────────────────
const DEFAULT_MEMORY = `# SofLIA — Memoria Persistente

## Preferencias Generales
<!-- Preferencias que aplican a todos los usuarios -->

## Lecciones Aprendidas
<!-- Correcciones y errores que no debo repetir -->

## Decisiones Arquitectónicas
<!-- Decisiones técnicas importantes del sistema -->

## Datos del Sistema
<!-- Información sobre el entorno, rutas, configuraciones -->
`;

// ─── Default user profile template ─────────────────────────────────
function defaultUserProfile(phoneNumber: string): string {
  return `# Perfil de Usuario: ${phoneNumber}

## Datos Personales
- Teléfono: ${phoneNumber}
- Nombre: (pendiente)
- Zona horaria: (pendiente)

## Preferencias de Comunicación
- Idioma: Español
- Estilo: (pendiente)

## Contexto Laboral
<!-- Empresa, rol, proyectos activos -->

## Notas Importantes
<!-- Datos relevantes aprendidos de las conversaciones -->
`;
}

// ─── KnowledgeService ───────────────────────────────────────────────
export class KnowledgeService {
  private initialized = false;

  constructor() {}

  // ─── Initialization ────────────────────────────────────────────────

  init(): void {
    try {
      // Create directory structure
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      fs.mkdirSync(USERS_DIR, { recursive: true });
      fs.mkdirSync(DAILY_DIR, { recursive: true });

      // Create default MEMORY.md if it doesn't exist
      if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(MEMORY_FILE, DEFAULT_MEMORY, 'utf-8');
        console.log('[KnowledgeService] Created default MEMORY.md');
      }

      this.initialized = true;
      console.log(`[KnowledgeService] Initialized at ${KNOWLEDGE_DIR}`);
    } catch (err: any) {
      console.error('[KnowledgeService] Init error:', err.message);
    }
  }

  // ─── Bootstrap Context (injected every turn) ───────────────────────

  /**
   * Returns the bootstrap context to inject into the system prompt.
   * Reads MEMORY.md + user profile, respects token caps.
   */
  getBootstrapContext(phoneNumber: string): string {
    if (!this.initialized) return '';

    let totalChars = 0;
    let sections = '';

    // 1. MEMORY.md (global knowledge)
    const memoryContent = this.readFileContent(MEMORY_FILE);
    if (memoryContent && memoryContent.trim().length > 50) {
      const truncated = this.truncate(memoryContent, BOOTSTRAP_MAX_CHARS);
      sections += `\n\n═══ BASE DE CONOCIMIENTO PERSISTENTE ═══\n${truncated}`;
      totalChars += truncated.length;
    }

    // 2. User profile
    if (totalChars < BOOTSTRAP_TOTAL_MAX_CHARS) {
      const userProfile = this.getUserProfile(phoneNumber);
      if (userProfile && userProfile.trim().length > 50) {
        const remaining = BOOTSTRAP_TOTAL_MAX_CHARS - totalChars;
        const maxForUser = Math.min(BOOTSTRAP_MAX_CHARS, remaining);
        const truncated = this.truncate(userProfile, maxForUser);
        sections += `\n\n═══ PERFIL DEL USUARIO ═══\n${truncated}`;
        totalChars += truncated.length;
      }
    }

    return sections;
  }

  // ─── File Operations (used by agent tools) ─────────────────────────

  /**
   * Append or update content in MEMORY.md under a specific section.
   */
  saveToMemory(content: string, section?: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };

    try {
      let currentContent = this.readFileContent(MEMORY_FILE) || DEFAULT_MEMORY;

      if (section) {
        // Try to find the section and append under it
        const sectionHeader = `## ${section}`;
        const sectionIndex = currentContent.indexOf(sectionHeader);

        if (sectionIndex !== -1) {
          // Find the end of the section (next ## or end of file)
          const afterHeader = sectionIndex + sectionHeader.length;
          const nextSection = currentContent.indexOf('\n## ', afterHeader);
          const insertAt = nextSection !== -1 ? nextSection : currentContent.length;

          // Insert content before the next section
          const before = currentContent.slice(0, insertAt);
          const after = currentContent.slice(insertAt);
          currentContent = `${before.trimEnd()}\n- ${content}\n${after}`;
        } else {
          // Section doesn't exist, create it
          currentContent += `\n## ${section}\n- ${content}\n`;
        }
      } else {
        // Append at the end
        currentContent += `\n- ${content}\n`;
      }

      fs.writeFileSync(MEMORY_FILE, currentContent, 'utf-8');
      console.log(`[KnowledgeService] MEMORY.md updated: "${content.slice(0, 60)}..."`);
      return { success: true, message: 'Conocimiento guardado en MEMORY.md' };
    } catch (err: any) {
      console.error('[KnowledgeService] saveToMemory error:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * Overwrite MEMORY.md entirely (for major reorganizations by the agent).
   */
  rewriteMemory(content: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };

    try {
      fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
      console.log('[KnowledgeService] MEMORY.md fully rewritten');
      return { success: true, message: 'MEMORY.md reescrito completamente.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Append to the daily log file (memory/YYYY-MM-DD.md).
   */
  saveToDailyLog(content: string, phoneNumber?: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dailyFile = path.join(DAILY_DIR, `${today}.md`);

      const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const prefix = phoneNumber ? `[${timestamp}] (${phoneNumber})` : `[${timestamp}]`;
      const entry = `${prefix} ${content}\n`;

      // Create file with header if it doesn't exist
      if (!fs.existsSync(dailyFile)) {
        const header = `# Registro Diario — ${today}\n\n`;
        fs.writeFileSync(dailyFile, header + entry, 'utf-8');
      } else {
        fs.appendFileSync(dailyFile, entry, 'utf-8');
      }

      return { success: true, message: 'Registrado en log diario.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Update user profile (create if doesn't exist).
   */
  updateUserProfile(phoneNumber: string, section: string, content: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };

    try {
      const userFile = path.join(USERS_DIR, `${this.sanitizePhone(phoneNumber)}.md`);
      let currentContent: string;

      if (fs.existsSync(userFile)) {
        currentContent = fs.readFileSync(userFile, 'utf-8');
      } else {
        currentContent = defaultUserProfile(phoneNumber);
      }

      // Find the section and update or append
      const sectionHeader = `## ${section}`;
      const sectionIndex = currentContent.indexOf(sectionHeader);

      if (sectionIndex !== -1) {
        const afterHeader = sectionIndex + sectionHeader.length;
        const nextSection = currentContent.indexOf('\n## ', afterHeader);
        const insertAt = nextSection !== -1 ? nextSection : currentContent.length;

        const before = currentContent.slice(0, insertAt);
        const after = currentContent.slice(insertAt);
        currentContent = `${before.trimEnd()}\n- ${content}\n${after}`;
      } else {
        currentContent += `\n## ${section}\n- ${content}\n`;
      }

      fs.writeFileSync(userFile, currentContent, 'utf-8');
      console.log(`[KnowledgeService] User profile updated for ${phoneNumber}: [${section}] ${content.slice(0, 40)}`);
      return { success: true, message: 'Perfil actualizado.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Read user profile content.
   */
  getUserProfile(phoneNumber: string): string | null {
    const userFile = path.join(USERS_DIR, `${this.sanitizePhone(phoneNumber)}.md`);
    return this.readFileContent(userFile);
  }

  /**
   * Read a specific knowledge file by name.
   */
  readKnowledgeFile(fileName: string): { success: boolean; content?: string; message?: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };

    // Security: only allow reading within knowledge directory
    const resolvedPath = this.resolveKnowledgePath(fileName);
    if (!resolvedPath) {
      return { success: false, message: `Archivo no encontrado: ${fileName}` };
    }

    const content = this.readFileContent(resolvedPath);
    if (content === null) {
      return { success: false, message: `No se pudo leer: ${fileName}` };
    }

    return { success: true, content };
  }

  /**
   * Search across all knowledge files for a query string.
   * Returns matching snippets with file context.
   */
  searchKnowledge(query: string, maxResults: number = 10): Array<{ file: string; line: number; snippet: string }> {
    if (!this.initialized) return [];

    const results: Array<{ file: string; line: number; snippet: string }> = [];
    const queryLower = query.toLowerCase();

    // Search in MEMORY.md
    this.searchInFile(MEMORY_FILE, 'MEMORY.md', queryLower, results, maxResults);

    // Search in user profiles
    if (results.length < maxResults && fs.existsSync(USERS_DIR)) {
      for (const file of fs.readdirSync(USERS_DIR)) {
        if (!file.endsWith('.md')) continue;
        if (results.length >= maxResults) break;
        this.searchInFile(
          path.join(USERS_DIR, file),
          `users/${file}`,
          queryLower,
          results,
          maxResults,
        );
      }
    }

    // Search in daily logs (most recent first)
    if (results.length < maxResults && fs.existsSync(DAILY_DIR)) {
      const dailyFiles = fs.readdirSync(DAILY_DIR)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 30); // Only last 30 days

      for (const file of dailyFiles) {
        if (results.length >= maxResults) break;
        this.searchInFile(
          path.join(DAILY_DIR, file),
          `memory/${file}`,
          queryLower,
          results,
          maxResults,
        );
      }
    }

    return results;
  }

  /**
   * List all knowledge files with their sizes.
   */
  listFiles(): Array<{ name: string; size: number; modified: string }> {
    if (!this.initialized) return [];

    const files: Array<{ name: string; size: number; modified: string }> = [];

    // MEMORY.md
    this.addFileInfo(MEMORY_FILE, 'MEMORY.md', files);

    // User profiles
    if (fs.existsSync(USERS_DIR)) {
      for (const f of fs.readdirSync(USERS_DIR)) {
        if (f.endsWith('.md')) {
          this.addFileInfo(path.join(USERS_DIR, f), `users/${f}`, files);
        }
      }
    }

    // Daily logs
    if (fs.existsSync(DAILY_DIR)) {
      for (const f of fs.readdirSync(DAILY_DIR).sort().reverse().slice(0, 15)) {
        if (f.endsWith('.md')) {
          this.addFileInfo(path.join(DAILY_DIR, f), `memory/${f}`, files);
        }
      }
    }

    return files;
  }

  /**
   * Auto-flush: Extract and persist important context from a conversation.
   * Called by the agent when session is ending or context is long.
   */
  autoFlush(phoneNumber: string, contextSummary: string): void {
    if (!contextSummary.trim()) return;
    this.saveToDailyLog(contextSummary, phoneNumber);
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private readFileContent(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n\n[... truncado por límite de contexto ...]';
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+]/g, '');
  }

  private resolveKnowledgePath(fileName: string): string | null {
    // Prevent path traversal
    const normalized = fileName.replace(/\\/g, '/').replace(/\.\./g, '');

    // Check common locations
    const candidates = [
      path.join(KNOWLEDGE_DIR, normalized),
      path.join(KNOWLEDGE_DIR, `${normalized}.md`),
    ];

    for (const candidate of candidates) {
      // Ensure it's within the knowledge directory
      if (!candidate.startsWith(KNOWLEDGE_DIR)) continue;
      if (fs.existsSync(candidate)) return candidate;
    }

    return null;
  }

  private searchInFile(
    filePath: string,
    displayName: string,
    queryLower: string,
    results: Array<{ file: string; line: number; snippet: string }>,
    maxResults: number,
  ): void {
    try {
      const content = this.readFileContent(filePath);
      if (!content) return;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;
        if (lines[i].toLowerCase().includes(queryLower)) {
          // Get surrounding context (1 line before, 1 after)
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(start, end + 1).join('\n').slice(0, 300);
          results.push({ file: displayName, line: i + 1, snippet });
        }
      }
    } catch {
      // Silently skip unreadable files
    }
  }

  private addFileInfo(
    filePath: string,
    displayName: string,
    files: Array<{ name: string; size: number; modified: string }>,
  ): void {
    try {
      const stat = fs.statSync(filePath);
      files.push({
        name: displayName,
        size: stat.size,
        modified: stat.mtime.toISOString().split('T')[0],
      });
    } catch {
      // Skip
    }
  }
}
