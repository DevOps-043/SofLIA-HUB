/**
 * ProactiveService — SofLIA's proactive notification engine.
 * 
 * Periodically checks Calendar events, IRIS/ProjectHub tasks, and system state,
 * then sends intelligent, conversational notifications to authenticated WhatsApp users.
 * 
 * Features:
 * - Configurable notification schedule (default: 8:00 AM and 8:00 PM)
 * - Calendar event reminders (today's events)
 * - IRIS task deadline alerts (due today / overdue)
 * - System process monitoring alerts
 * - Uses Gemini to compose natural messages
 * 
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// ─── Config persistence ─────────────────────────────────────────────
const PROACTIVE_CONFIG_PATH = path.join(app.getPath('userData'), 'proactive-config.json');

export interface ProactiveConfig {
  enabled: boolean;
  /** Hours of the day to send notifications (0-23). Default: [8, 20] */
  notificationHours: number[];
  /** Check interval in minutes (how often to check if it's time). Default: 5 */
  checkIntervalMinutes: number;
  /** Enable calendar reminders */
  calendarReminders: boolean;
  /** Enable project hub task reminders */
  taskReminders: boolean;
  /** Enable system monitoring alerts */
  systemAlerts: boolean;
  /** User's timezone offset in hours (auto-detected) */
  timezoneOffset: number;
}

const DEFAULT_CONFIG: ProactiveConfig = {
  enabled: true,
  notificationHours: [8, 20], // 8 AM and 8 PM
  checkIntervalMinutes: 5,
  calendarReminders: true,
  taskReminders: true,
  systemAlerts: true,
  timezoneOffset: new Date().getTimezoneOffset() / -60,
};

function loadProactiveConfig(): ProactiveConfig {
  try {
    if (fs.existsSync(PROACTIVE_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROACTIVE_CONFIG_PATH, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULT_CONFIG };
}

function saveProactiveConfig(config: ProactiveConfig): void {
  fs.writeFileSync(PROACTIVE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ─── Types for collected data ────────────────────────────────────────
interface CalendarEventData {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

interface TaskData {
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectName?: string;
  isOverdue: boolean;
  isDueToday: boolean;
}

interface SystemAlert {
  type: 'high_cpu' | 'high_memory' | 'critical_process' | 'new_process';
  description: string;
  processName?: string;
  value?: number;
}

interface ProactivePayload {
  calendarEvents: CalendarEventData[];
  urgentTasks: TaskData[];
  systemAlerts: SystemAlert[];
  timestamp: Date;
  userName: string;
}

// ─── Service ─────────────────────────────────────────────────────────
export class ProactiveService extends EventEmitter {
  private config: ProactiveConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastNotifiedHours: Map<string, Set<number>> = new Map(); // phoneNumber -> Set of hours already notified today
  private lastNotifiedDate: string = ''; // Track date to reset hourly notifications

  // External service references (injected)
  private calendarService: any = null;
  private waService: any = null;
  private apiKey: string = '';

  constructor() {
    super();
    this.config = loadProactiveConfig();
  }

  // ─── Dependency injection ──────────────────────────────────────
  setCalendarService(calService: any): void {
    this.calendarService = calService;
  }

  setWhatsAppService(waService: any): void {
    this.waService = waService;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  // ─── Config management ─────────────────────────────────────────
  getConfig(): ProactiveConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProactiveConfig>): void {
    this.config = { ...this.config, ...updates };
    saveProactiveConfig(this.config);
    console.log('[ProactiveService] Config updated:', this.config);

    // Restart if running
    if (this.checkInterval) {
      this.stop();
      this.start();
    }
  }

  // ─── Start / Stop ──────────────────────────────────────────────
  start(): void {
    if (this.checkInterval) return;
    if (!this.config.enabled) {
      console.log('[ProactiveService] Disabled — not starting.');
      return;
    }

    const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
    console.log(`[ProactiveService] Starting — checking every ${this.config.checkIntervalMinutes} min, notification hours: ${this.config.notificationHours.join(', ')}`);

    this.checkInterval = setInterval(() => this.tick(), intervalMs);

    // Also do an immediate check
    setTimeout(() => this.tick(), 5000);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[ProactiveService] Stopped.');
    }
  }

  isRunning(): boolean {
    return this.checkInterval !== null;
  }

  // ─── Main tick: check if it's time to notify ──────────────────
  private async tick(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = now.toISOString().split('T')[0];

      // Reset daily tracking
      if (todayStr !== this.lastNotifiedDate) {
        this.lastNotifiedDate = todayStr;
        this.lastNotifiedHours.clear();
      }

      // Check if current hour matches a notification hour
      if (!this.config.notificationHours.includes(currentHour)) {
        return; // Not notification time
      }

      // Get all authenticated WhatsApp sessions
      const { getAllWhatsAppSessions } = await import('./iris-data-main');
      const sessions = getAllWhatsAppSessions();

      if (!sessions || sessions.length === 0) {
        return; // No authenticated users
      }

      // Check WhatsApp connection
      if (!this.waService || !this.waService.isConnected()) {
        return; // WhatsApp not connected
      }

      for (const session of sessions) {
        const phoneNumber = session.phoneNumber;

        // Check if we already notified this user at this hour today
        if (!this.lastNotifiedHours.has(phoneNumber)) {
          this.lastNotifiedHours.set(phoneNumber, new Set());
        }
        const notifiedHours = this.lastNotifiedHours.get(phoneNumber)!;

        if (notifiedHours.has(currentHour)) {
          continue; // Already notified this user at this hour
        }

        // Collect data and send notification
        console.log(`[ProactiveService] Sending notification to ${session.fullName} (${phoneNumber}) at hour ${currentHour}`);
        
        try {
          const payload = await this.collectData(session);
          
          // Only send if there's something to report
          if (payload.calendarEvents.length > 0 || payload.urgentTasks.length > 0 || payload.systemAlerts.length > 0) {
            const message = await this.composeMessage(payload);
            
            if (message) {
              const jid = `${phoneNumber}@s.whatsapp.net`;
              await this.waService.sendText(jid, message);
              console.log(`[ProactiveService] ✅ Notification sent to ${session.fullName}`);
              this.emit('notification-sent', { phoneNumber, userName: session.fullName, hour: currentHour });
            }
          } else {
            console.log(`[ProactiveService] No pending items for ${session.fullName} — skipping.`);
          }

          // Mark as notified
          notifiedHours.add(currentHour);
        } catch (err) {
          console.error(`[ProactiveService] Error sending notification to ${phoneNumber}:`, err);
        }
      }
    } catch (err) {
      console.error('[ProactiveService] Tick error:', err);
    }
  }

  // ─── Data collection ───────────────────────────────────────────
  private async collectData(session: any): Promise<ProactivePayload> {
    const payload: ProactivePayload = {
      calendarEvents: [],
      urgentTasks: [],
      systemAlerts: [],
      timestamp: new Date(),
      userName: session.fullName || session.username || 'Usuario',
    };

    // 1. Calendar events
    if (this.config.calendarReminders && this.calendarService) {
      try {
        const events = await this.calendarService.getCurrentEvents();
        payload.calendarEvents = (events || []).map((e: any) => ({
          title: e.title,
          start: e.start instanceof Date ? e.start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : String(e.start),
          end: e.end instanceof Date ? e.end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : String(e.end),
          location: e.location,
          description: e.description,
        }));
      } catch (err) {
        console.warn('[ProactiveService] Calendar fetch error:', err);
      }
    }

    // 2. IRIS tasks (due today or overdue)
    if (this.config.taskReminders) {
      try {
        const { getIssues, getProjects } = await import('./iris-data-main');
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Get all tasks for the user's teams
        const allIssues = await getIssues({
          assigneeId: session.userId,
          limit: 50,
        });

        // Get projects for context
        const projects = await getProjects();
        const projectMap = new Map(projects.map((p: any) => [p.project_id, p.project_name]));

        for (const issue of allIssues) {
          // Skip completed/cancelled tasks
          const statusType = issue.status?.status_type?.toLowerCase() || '';
          if (statusType === 'done' || statusType === 'cancelled' || statusType === 'completed') {
            continue;
          }

          if (issue.due_date) {
            const dueDate = issue.due_date.split('T')[0];
            const isOverdue = dueDate < todayStr;
            const isDueToday = dueDate === todayStr;

            if (isOverdue || isDueToday) {
              payload.urgentTasks.push({
                title: issue.title,
                status: issue.status?.name || 'Sin estado',
                priority: issue.priority?.name,
                dueDate: issue.due_date,
                projectName: issue.project_id ? projectMap.get(issue.project_id) : undefined,
                isOverdue,
                isDueToday,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[ProactiveService] IRIS fetch error:', err);
      }
    }

    // 3. System alerts
    if (this.config.systemAlerts) {
      try {
        const alerts = await this.checkSystemState();
        payload.systemAlerts = alerts;
      } catch (err) {
        console.warn('[ProactiveService] System check error:', err);
      }
    }

    return payload;
  }

  // ─── System state check ────────────────────────────────────────
  private async checkSystemState(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    try {
      // Check for high CPU / memory processes (Windows)
      const { stdout } = await execAsync(
        'powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, Id, @{N=\'CPU_Seconds\';E={[math]::Round($_.CPU,1)}}, @{N=\'Memory_MB\';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json"',
        { timeout: 10000 }
      );

      const processes = JSON.parse(stdout);
      const processList = Array.isArray(processes) ? processes : [processes];

      for (const proc of processList) {
        // Alert if a single process uses > 2GB RAM
        if (proc.Memory_MB > 2048) {
          alerts.push({
            type: 'high_memory',
            description: `${proc.Name} está usando ${proc.Memory_MB} MB de memoria RAM`,
            processName: proc.Name,
            value: proc.Memory_MB,
          });
        }
      }

      // Check overall memory usage
      const { stdout: memOut } = await execAsync(
        'powershell -Command "(Get-CimInstance Win32_OperatingSystem | Select-Object @{N=\'UsedPercent\';E={[math]::Round((($_.TotalVisibleMemorySize - $_.FreePhysicalMemory) / $_.TotalVisibleMemorySize) * 100, 1)}}).UsedPercent"',
        { timeout: 10000 }
      );

      const memPercent = parseFloat(memOut.trim());
      if (memPercent > 85) {
        alerts.push({
          type: 'high_memory',
          description: `La memoria RAM del sistema está al ${memPercent}%`,
          value: memPercent,
        });
      }
    } catch (err) {
      // System checks are non-critical
      console.warn('[ProactiveService] System state check failed:', err);
    }

    return alerts;
  }

  // ─── Compose natural message with Gemini ───────────────────────
  private async composeMessage(payload: ProactivePayload): Promise<string | null> {
    if (!this.apiKey) {
      // Fallback: compose without AI
      return this.composeMessageFallback(payload);
    }

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

      const now = new Date();
      const hour = now.getHours();
      const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

      const prompt = `Eres SofLIA, una asistente virtual proactiva e inteligente. Tu tarea es componer un mensaje de WhatsApp amigable y conciso para notificar al usuario sobre sus pendientes del día.

REGLAS:
- Habla en español, de forma natural y cálida como una asistente personal
- No uses markdown pesado (no ### ni **bold**), usa solo emojis y texto plano
- Sé concisa: máximo 300 palabras
- Si hay tareas vencidas, dale prioridad y urgencia amable
- Si no hay mucho que reportar, sé breve
- El saludo debe ser "${greeting}, ${payload.userName}" 
- Firma como "SofLIA 💜"
- Usa emojis estratégicamente (📅 para calendario, ✅ para tareas, ⚠️ para alertas)
- Formatea la hora actual: ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}

DATOS A INCLUIR:

${payload.calendarEvents.length > 0 ? `📅 EVENTOS DEL CALENDARIO (${payload.calendarEvents.length}):
${payload.calendarEvents.map(e => `- "${e.title}" de ${e.start} a ${e.end}${e.location ? ` en ${e.location}` : ''}`).join('\n')}` : 'No hay eventos de calendario hoy.'}

${payload.urgentTasks.length > 0 ? `✅ TAREAS URGENTES (${payload.urgentTasks.length}):
${payload.urgentTasks.map(t => `- "${t.title}" [${t.status}]${t.priority ? ` (${t.priority})` : ''}${t.projectName ? ` — Proyecto: ${t.projectName}` : ''} — ${t.isOverdue ? '⚠️ VENCIDA' : 'Vence hoy'}`).join('\n')}` : 'No hay tareas urgentes.'}

${payload.systemAlerts.length > 0 ? `🖥️ ALERTAS DEL SISTEMA (${payload.systemAlerts.length}):
${payload.systemAlerts.map(a => `- ${a.description}`).join('\n')}` : ''}

Compón el mensaje ahora. Solo responde con el mensaje, sin explicaciones adicionales.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return text || this.composeMessageFallback(payload);
    } catch (err) {
      console.warn('[ProactiveService] Gemini compose error, using fallback:', err);
      return this.composeMessageFallback(payload);
    }
  }

  // ─── Fallback composer (no AI) ─────────────────────────────────
  private composeMessageFallback(payload: ProactivePayload): string {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

    let msg = `${greeting}, ${payload.userName} 👋\n\n`;
    msg += `📋 *Resumen de Pendientes*\n`;
    msg += `🕐 ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n\n`;

    if (payload.calendarEvents.length > 0) {
      msg += `📅 *Eventos del Calendario:*\n`;
      for (const ev of payload.calendarEvents) {
        msg += `  • ${ev.title} — ${ev.start} a ${ev.end}\n`;
        if (ev.location) msg += `    📍 ${ev.location}\n`;
      }
      msg += '\n';
    }

    if (payload.urgentTasks.length > 0) {
      const overdue = payload.urgentTasks.filter(t => t.isOverdue);
      const dueToday = payload.urgentTasks.filter(t => t.isDueToday);

      if (overdue.length > 0) {
        msg += `⚠️ *Tareas VENCIDAS (${overdue.length}):*\n`;
        for (const t of overdue) {
          msg += `  • ${t.title}${t.projectName ? ` (${t.projectName})` : ''}\n`;
        }
        msg += '\n';
      }

      if (dueToday.length > 0) {
        msg += `📌 *Vencen HOY (${dueToday.length}):*\n`;
        for (const t of dueToday) {
          msg += `  • ${t.title}${t.projectName ? ` (${t.projectName})` : ''}\n`;
        }
        msg += '\n';
      }
    }

    if (payload.systemAlerts.length > 0) {
      msg += `🖥️ *Alertas del Sistema:*\n`;
      for (const a of payload.systemAlerts) {
        msg += `  • ${a.description}\n`;
      }
      msg += '\n';
    }

    msg += `— SofLIA 💜`;
    return msg;
  }

  // ─── Manual trigger (for testing) ──────────────────────────────
  async triggerNow(phoneNumber?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { getAllWhatsAppSessions } = await import('./iris-data-main');
      let sessions = getAllWhatsAppSessions();

      if (phoneNumber) {
        sessions = sessions.filter((s: any) => s.phoneNumber === phoneNumber);
      }

      if (sessions.length === 0) {
        return { success: false, error: 'No hay sesiones de WhatsApp autenticadas.' };
      }

      if (!this.waService || !this.waService.isConnected()) {
        return { success: false, error: 'WhatsApp no está conectado.' };
      }

      for (const session of sessions) {
        const payload = await this.collectData(session);
        const message = await this.composeMessage(payload);

        if (message) {
          const jid = `${session.phoneNumber}@s.whatsapp.net`;
          await this.waService.sendText(jid, message);
        }
      }

      return { success: true, message: `Notificación enviada a ${sessions.length} usuario(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
