import { EventEmitter } from 'node:events';
import cron from 'node-cron';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from './whatsapp-service';

export interface DailyBriefingConfig {
  enabled: boolean;
  schedule: string;
  ownerNumber: string;
  apiKey: string;
}

export interface DailyBriefingStatus {
  isRunning: boolean;
  lastRun?: Date;
  config: DailyBriefingConfig;
}

export class DailyBriefingService extends EventEmitter {
  private config: DailyBriefingConfig;
  private task: cron.ScheduledTask | null = null;
  private waService: WhatsAppService;
  private isRunning: boolean = false;
  private lastRun?: Date;

  constructor(config: DailyBriefingConfig, waService: WhatsAppService) {
    super();
    this.config = config;
    this.waService = waService;
  }

  async init(): Promise<void> {
    console.log('[DailyBriefing] Inicializando servicio...');
  }

  async start(): Promise<void> {
    if (this.task) {
      this.task.stop();
    }

    if (!this.config.enabled || !this.config.ownerNumber || !this.config.apiKey) {
      console.log('[DailyBriefing] Servicio deshabilitado o falta configuración básica (ownerNumber o apiKey).');
      return;
    }

    this.isRunning = true;
    
    // Por defecto: '0 8 * * 1-5' (De lunes a viernes a las 08:00 AM)
    const scheduleStr = this.config.schedule || '0 8 * * 1-5';
    
    this.task = cron.schedule(scheduleStr, async () => {
      console.log('[DailyBriefing] Ejecutando rutina de briefing diario programada...');
      await this.runBriefing();
    });
    
    console.log(`[DailyBriefing] Servicio iniciado con horario: ${scheduleStr}`);
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    console.log('[DailyBriefing] Servicio detenido.');
    this.emit('stopped');
  }

  getStatus(): DailyBriefingStatus {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      config: this.config,
    };
  }

  getConfig(): DailyBriefingConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<DailyBriefingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.isRunning) {
      this.start(); // Reinicia el cron con la nueva configuración
    }
  }

  /**
   * Ejecuta la lógica del briefing diario de forma manual.
   * Útil para pruebas o para solicitar un resumen bajo demanda.
   */
  async runNow(): Promise<void> {
    if (!this.config.apiKey || !this.config.ownerNumber) {
      throw new Error('Falta configuración requerida (apiKey o ownerNumber) para ejecutar el briefing.');
    }
    await this.runBriefing();
  }

  private async runBriefing(): Promise<void> {
    try {
      this.lastRun = new Date();
      
      // 1) Recopilar datos base nativos
      const dateStr = new Date().toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
      const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
      
      let diskInfo = 'No disponible';
      let processesInfo = 'No disponible';
      
      try {
        if (os.platform() === 'win32') {
          // Información de disco en Windows
          diskInfo = execSync('wmic logicaldisk get caption,freespace,size', { encoding: 'utf-8' }).trim();
          
          // Top 5 procesos que más CPU consumen
          const psCommand = `Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, CPU | Format-Table -HideTableHeaders`;
          processesInfo = execSync(`powershell -NoProfile -Command "${psCommand}"`, { encoding: 'utf-8' }).trim();
        } else {
          // Linux/macOS fallback
          diskInfo = execSync('df -h /', { encoding: 'utf-8' }).trim();
          processesInfo = execSync('ps -eo comm,%cpu,%mem --sort=-%cpu | head -n 6', { encoding: 'utf-8' }).trim();
        }
      } catch (err: any) {
        console.warn('[DailyBriefing] Error parcial recopilando datos nativos:', err.message);
      }

      const systemData = `
Fecha: ${dateStr}
Memoria RAM: Libre ${freeMem} GB de ${totalMem} GB
Espacio en Disco:
${diskInfo}

Top 5 Procesos Activos (CPU):
${processesInfo}
      `;

      // 2) Realizar prompt a Gemini (con backoff exponencial)
      const prompt = `
Genera un "Resumen Ejecutivo" matutino muy breve y motivador para el usuario, basado en la siguiente información del sistema. 
Actúa como SofLIA, el sistema operativo de IA. 
Instrucciones:
1. Da los buenos días y menciona la fecha.
2. Proporciona un resumen rápido del estado del sistema de forma amigable (sin ser alarmista, pero destaca si queda poca RAM o espacio).
3. Ofrécele ayuda proactiva para organizar su día, revisar su calendario, sus emails o gestionar sus proyectos.
4. Usa emojis y mantén un formato limpio apto para WhatsApp (puedes usar *negritas* para enfatizar, pero evita markdown complejo o tablas).
5. Sé conciso: no superes los 3 párrafos cortos.

Datos del sistema actual:
${systemData}
      `;

      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      let summary = '';
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        try {
          const result = await model.generateContent(prompt);
          summary = result.response.text();
          break; // Éxito, salir del bucle
        } catch (err: any) {
          attempt++;
          console.error(`[DailyBriefing] Error con Gemini (intento ${attempt}):`, err.message);
          
          if (attempt >= maxAttempts) {
            // Fallback en caso de que la IA falle por completo
            summary = `☀️ ¡Buenos días! Hoy es ${dateStr}.\n\n*(Nota: Tuve un problema conectando con mi motor cognitivo, pero el sistema está funcional).* \n\nMi diagnóstico rápido:\n• Memoria RAM: ${freeMem} GB libres.\n\n¿En qué te puedo ayudar hoy para que sea un gran día?`;
            break;
          }
          
          // Backoff exponencial: 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
        }
      }

      summary = summary.trim();

      // 3) Transmitir el resultado por WhatsApp usando WhatsAppService
      if (this.waService && this.waService.isConnected()) {
        const ownerNumber = this.config.ownerNumber;
        const jid = ownerNumber.includes('@') ? ownerNumber : `${ownerNumber.replace(/\D/g, '')}@s.whatsapp.net`;
        
        // Cumpliendo con la instrucción: Intentar usar sendProactiveMessage si existe,
        // de lo contrario usar sendText, que es el método comprobado en el proyecto.
        const waServiceAny = this.waService as any;
        if (typeof waServiceAny.sendProactiveMessage === 'function') {
          await waServiceAny.sendProactiveMessage(ownerNumber, summary);
        } else {
          await this.waService.sendText(jid, summary);
        }
        
        console.log(`[DailyBriefing] Resumen ejecutivo diario enviado con éxito a ${ownerNumber}`);
        this.emit('briefing-sent', { success: true, to: ownerNumber });
      } else {
        console.warn('[DailyBriefing] No se pudo enviar el resumen porque WhatsApp no está conectado.');
        this.emit('briefing-sent', { success: false, error: 'WhatsApp desconectado' });
      }

    } catch (err: any) {
      console.error('[DailyBriefing] Error general en la ejecución del briefing diario:', err.message);
      this.emit('briefing-error', err);
    }
  }
}
