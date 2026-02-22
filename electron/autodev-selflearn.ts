/**
 * AutoDev Self-Learning Module
 * 
 * Detects SofLIA's own failures, limitations, and user feedback from interactions
 * (WhatsApp, Chat, Computer Use) and logs them to AUTODEV_ISSUES.md so that
 * future AutoDev runs can prioritize fixing these issues.
 * 
 * Categories of self-diagnosis:
 *   1. USER_COMPLAINT    — User explicitly says SofLIA failed or didn't do something
 *   2. USER_SUGGESTION   — User suggests an improvement or feature
 *   3. TOOL_FAILURE      — A tool call returned an error
 *   4. COMPUTER_USE_FAIL — Computer Use didn't achieve its goal
 *   5. UNVERIFIED_ACTION — SofLIA said it would do something but may not have
 *   6. API_LIMITATION    — API returned an error or is not configured
 *   7. HALLUCINATION     — SofLIA claimed to do something it cannot do
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── Patterns that indicate user complaints ─────────────────────────

const COMPLAINT_PATTERNS = [
  // Spanish
  /no (lo )?hiciste/i,
  /no funciona/i,
  /no sirve/i,
  /sigue (sin|igual|apagado|cerrado)/i,
  /no (se )?descarg[oó]/i,
  /no (se )?abri[oó]/i,
  /no (se )?guard[oó]/i,
  /no (se )?envi[oó]/i,
  /no (se )?cre[oó]/i,
  /no (está|esta) (hecho|listo)/i,
  /no pasó nada/i,
  /no paso nada/i,
  /mentira/i,
  /eso no (es cierto|paso)/i,
  /no (se|lo) ejecut[oó]/i,
  /c[oó]mo vas/i, // "cómo vas?" implies SofLIA hasn't delivered
  /ya (lo )?hiciste/i,
  /sigues sin/i,
  /no me (pasaste|enviaste|mandaste)/i,
  /lleva (mucho|rato|tiempo)/i,
  /(deja de|para de|no) menti(r|s)/i,
  /pero no/i,
  /se supone que/i,
  /(qué|que) pas[oó] con/i,
  /no (has|haz) hecho nada/i,
];

const SUGGESTION_PATTERNS = [
  /deber[ií]as? (poder|hacer|saber|tener)/i,
  /estar[ií]a (bien|bueno|mejor) (que|si)/i,
  /ser[ií]a (bueno|mejor|útil|genial) (que|si)/i,
  /por qu[eé] no (puedes|haces|tienes)/i,
  /te falta(n)? /i,
  /necesitas (poder|saber|aprender|mejorar)/i,
  /a[gñ]ade|agrega|implementa/i,
  /sugiero que/i,
  /quiero que (puedas|aprendas|mejores)/i,
  /me gustar[ií]a que/i,
  /podr[ií]as/i,
];

// ─── Patterns in SofLIA's own responses that reveal unverified actions ──

const UNVERIFIED_ACTION_PATTERNS = [
  /voy a (descargar|crear|abrir|enviar|guardar|mover)/i,
  /ya (estoy|empecé|comencé) a (descargar|crear|abrir)/i,
  /enseguida (empiezo|comienzo|lo hago)/i,
  /te aviso cuando/i,
  /estoy (trabajando|descargando|creando|abriendo)/i,
  /esto puede tardar/i,
  /te mantendré (al tanto|informado)/i,
  /déjame intentar/i,
  /voy a verificar/i,
];

// ─── Types ──────────────────────────────────────────────────────────

export type SelfLearnCategory =
  | 'user_complaint'
  | 'user_suggestion'
  | 'tool_failure'
  | 'computer_use_fail'
  | 'unverified_action'
  | 'api_limitation'
  | 'hallucination';

interface SelfLearnEntry {
  timestamp: string;
  category: SelfLearnCategory;
  source: 'whatsapp' | 'chat' | 'computer_use' | 'system';
  description: string;
  userMessage?: string;
  sofLIAResponse?: string;
  toolName?: string;
  toolError?: string;
  context?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const ISSUES_FILENAME = 'AUTODEV_ISSUES.md';
const FEEDBACK_FILENAME = 'AUTODEV_FEEDBACK.md';
const MAX_ENTRIES_PER_FILE = 200;

export class SelfLearnService {
  private repoPath: string;
  private recentSofLIAResponses: Map<string, string> = new Map(); // jid → last response

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Analyze a user message for complaints or suggestions.
   * Call this for every incoming WhatsApp/Chat message.
   */
  analyzeUserMessage(
    userMessage: string,
    source: 'whatsapp' | 'chat',
    context?: { jid?: string; senderNumber?: string },
  ): void {
    // Check for complaints
    for (const pattern of COMPLAINT_PATTERNS) {
      if (pattern.test(userMessage)) {
        const lastResponse = context?.jid ? this.recentSofLIAResponses.get(context.jid) : undefined;
        this.logEntry({
          timestamp: new Date().toISOString(),
          category: 'user_complaint',
          source,
          description: `El usuario se quejó de que SofLIA no completó una acción correctamente.`,
          userMessage: userMessage.slice(0, 500),
          sofLIAResponse: lastResponse?.slice(0, 500),
          context: `Patrón detectado: ${pattern.source}`,
        });
        break; // Only log once per message
      }
    }

    // Check for suggestions
    for (const pattern of SUGGESTION_PATTERNS) {
      if (pattern.test(userMessage)) {
        this.logFeedback({
          timestamp: new Date().toISOString(),
          category: 'user_suggestion',
          source,
          description: `El usuario hizo una sugerencia de mejora.`,
          userMessage: userMessage.slice(0, 500),
        });
        break;
      }
    }
  }

  /**
   * Track SofLIA's response for future complaint correlation.
   * Call this after SofLIA sends a response.
   */
  trackSofLIAResponse(jid: string, response: string): void {
    this.recentSofLIAResponses.set(jid, response);
    // Keep max 50 tracked responses
    if (this.recentSofLIAResponses.size > 50) {
      const firstKey = this.recentSofLIAResponses.keys().next().value;
      if (firstKey) this.recentSofLIAResponses.delete(firstKey);
    }

    // Check if SofLIA's response contains unverified action promises
    for (const pattern of UNVERIFIED_ACTION_PATTERNS) {
      if (pattern.test(response)) {
        // Don't log immediately — we'll see if the user complains later
        // Just mark it as a "pending promise" for this jid
        break;
      }
    }
  }

  /**
   * Log a tool execution failure.
   * Call this when any tool returns an error.
   */
  logToolFailure(
    toolName: string,
    args: Record<string, any>,
    error: string,
    source: 'whatsapp' | 'chat' | 'system' = 'whatsapp',
  ): void {
    this.logEntry({
      timestamp: new Date().toISOString(),
      category: 'tool_failure',
      source,
      description: `La herramienta \`${toolName}\` falló con error: ${error}`,
      toolName,
      toolError: error,
      context: `Args: ${JSON.stringify(args).slice(0, 500)}`,
    });
  }

  /**
   * Log a Computer Use failure.
   * Call this when Computer Use task fails to achieve its goal.
   */
  logComputerUseFailure(task: string, error: string): void {
    this.logEntry({
      timestamp: new Date().toISOString(),
      category: 'computer_use_fail',
      source: 'computer_use',
      description: `Computer Use no pudo completar la tarea: "${task.slice(0, 200)}"`,
      toolName: 'use_computer',
      toolError: error,
      context: `Tarea solicitada: ${task}`,
    });
  }

  /**
   * Log an API limitation (service not configured, not connected, etc.)
   */
  logAPILimitation(service: string, error: string): void {
    this.logEntry({
      timestamp: new Date().toISOString(),
      category: 'api_limitation',
      source: 'system',
      description: `El servicio ${service} no está disponible o no está configurado: ${error}`,
      context: `Service: ${service}`,
    });
  }

  /**
   * Directly log a user suggestion (explicit, from WhatsApp or Chat).
   */
  logUserSuggestion(suggestion: string, source: 'whatsapp' | 'chat'): void {
    this.logFeedback({
      timestamp: new Date().toISOString(),
      category: 'user_suggestion',
      source,
      description: suggestion,
      userMessage: suggestion,
    });
  }

  // ─── File I/O ────────────────────────────────────────────────────

  private get issuesPath(): string {
    return path.join(this.repoPath, ISSUES_FILENAME);
  }

  private get feedbackPath(): string {
    return path.join(this.repoPath, FEEDBACK_FILENAME);
  }

  private logEntry(entry: SelfLearnEntry): void {
    this.appendToFile(this.issuesPath, entry, 'Issues & Self-Diagnosis Log');
  }

  private logFeedback(entry: SelfLearnEntry): void {
    this.appendToFile(this.feedbackPath, entry, 'User Feedback & Suggestions');
  }

  private appendToFile(filePath: string, entry: SelfLearnEntry, fileTitle: string): void {
    try {
      let existing = '';
      try {
        if (fs.existsSync(filePath)) {
          existing = fs.readFileSync(filePath, 'utf-8');
        }
      } catch { /* ignore */ }

      const header = existing
        ? ''
        : [
            `# 🤖 AutoDev — ${fileTitle}`,
            '',
            `> Este archivo es generado automáticamente por el sistema de auto-aprendizaje de SofLIA.`,
            `> SofLIA detecta sus propias limitaciones, fallas, y sugerencias del usuario.`,
            `> AutoDev usa este archivo como contexto para priorizar mejoras en futuras ejecuciones.`,
            `> **No borres este archivo** — las entradas se marcarán como resueltas cuando se corrijan.`,
            '',
            '---',
            '',
          ].join('\n');

      const categoryIcon: Record<string, string> = {
        user_complaint: '🗣️ QUEJA DE USUARIO',
        user_suggestion: '💡 SUGERENCIA',
        tool_failure: '🔧 FALLA DE HERRAMIENTA',
        computer_use_fail: '🖥️ FALLA COMPUTER USE',
        unverified_action: '⚠️ ACCIÓN NO VERIFICADA',
        api_limitation: '🔌 LIMITACIÓN DE API',
        hallucination: '🌀 ALUCINACIÓN',
      };

      const md = [
        `## ❌ [${categoryIcon[entry.category] || entry.category.toUpperCase()}] — ${entry.timestamp.split('T')[0]}`,
        '',
        `- **Timestamp**: ${entry.timestamp}`,
        `- **Fuente**: ${entry.source}`,
        `- **Estado**: 🔴 PENDIENTE`,
        '',
        '### Descripción',
        '',
        entry.description,
        '',
        ...(entry.userMessage ? ['### Mensaje del usuario', '', `> ${entry.userMessage.replace(/\n/g, '\n> ')}`, ''] : []),
        ...(entry.sofLIAResponse ? ['### Respuesta de SofLIA', '', `> ${entry.sofLIAResponse.replace(/\n/g, '\n> ')}`, ''] : []),
        ...(entry.toolName ? [`- **Herramienta**: \`${entry.toolName}\``] : []),
        ...(entry.toolError ? [`- **Error**: ${entry.toolError}`] : []),
        ...(entry.context ? ['### Contexto', '', '```', entry.context.slice(0, 2000), '```', ''] : []),
        '---',
        '',
      ].join('\n');

      // Check if file is too large (trim old entries)
      const entryCount = (existing.match(/## ❌/g) || []).length;
      if (entryCount > MAX_ENTRIES_PER_FILE) {
        // Keep header + last N entries
        const parts = existing.split('## ❌');
        const keepParts = parts.slice(-(MAX_ENTRIES_PER_FILE - 20));
        existing = parts[0] + keepParts.map(p => '## ❌' + p).join('');
      }

      fs.writeFileSync(filePath, header + existing + md, 'utf-8');
      console.log(`[SelfLearn] Logged: [${entry.category}] ${entry.description.slice(0, 80)}`);
    } catch (err: any) {
      console.error('[SelfLearn] Failed to write:', err.message);
    }
  }

  /**
   * Get all open issues + feedback as context string for AutoDev agents.
   */
  getFullContext(): string {
    const parts: string[] = [];

    // Read issues file
    try {
      if (fs.existsSync(this.issuesPath)) {
        const content = fs.readFileSync(this.issuesPath, 'utf-8');
        const sections = content.split('## ❌');
        const pending = sections.filter(s => s.includes('🔴 PENDIENTE'));
        if (pending.length) {
          parts.push('\n═══ SELF-DIAGNOSED ISSUES (SofLIA detected these about itself) ═══');
          parts.push(...pending.slice(-30).map(s => '## ❌' + s.split('---')[0]));
        }
      }
    } catch { /* ignore */ }

    // Read feedback file
    try {
      if (fs.existsSync(this.feedbackPath)) {
        const content = fs.readFileSync(this.feedbackPath, 'utf-8');
        const sections = content.split('## ❌');
        const pending = sections.filter(s => s.includes('🔴 PENDIENTE'));
        if (pending.length) {
          parts.push('\n═══ USER FEEDBACK & SUGGESTIONS ═══');
          parts.push(...pending.slice(-20).map(s => '## ❌' + s.split('---')[0]));
        }
      }
    } catch { /* ignore */ }

    if (!parts.length) return '';

    parts.push('═══ END SELF-DIAGNOSIS CONTEXT ═══\n');
    return parts.join('\n');
  }
}
