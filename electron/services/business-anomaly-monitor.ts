import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface AnomalyMonitorConfig {
  checkIntervalMs: number;
  alertThresholdMs: number;
  projectsDir?: string;
}

export interface AnomalyMonitorStatus {
  running: boolean;
  lastCheck: Date | null;
  anomaliesDetected: number;
}

export class BusinessAnomalyMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private calendarService: any;
  private whatsappClient: any;
  private config: AnomalyMonitorConfig;
  private status: AnomalyMonitorStatus;
  private notifiedEvents: Set<string> = new Set();

  constructor(config?: Partial<AnomalyMonitorConfig>) {
    super();
    this.config = {
      checkIntervalMs: 3600000, // 1 hora por defecto
      alertThresholdMs: 7200000, // 2 horas por defecto
      ...config
    };
    
    // Autodetectar directorio de proyectos si no se provee
    if (!this.config.projectsDir) {
      const homeDir = os.homedir();
      this.config.projectsDir = path.join(homeDir, 'Projects');
    }

    this.status = {
      running: false,
      lastCheck: null,
      anomaliesDetected: 0
    };
  }

  /**
   * Inyectar el servicio de calendario real para obtener eventos
   */
  setCalendarService(calendarService: any): void {
    this.calendarService = calendarService;
  }

  /**
   * Inyectar el cliente de WhatsApp para enviar alertas directas
   */
  setWhatsAppClient(whatsappClient: any): void {
    this.whatsappClient = whatsappClient;
  }

  async init(): Promise<void> {
    console.log('[BusinessAnomalyMonitor] Inicializado con config:', this.config);
  }

  start(): void {
    if (this.status.running) return;
    
    // Ejecutar chequeo inicial
    this.checkAnomalies().catch(err => console.error('[BusinessAnomalyMonitor] Error en chequeo inicial:', err.message));
    
    this.intervalId = setInterval(async () => {
      await this.checkAnomalies();
    }, this.config.checkIntervalMs);

    this.status.running = true;
    this.emit('started');
    console.log('[BusinessAnomalyMonitor] Monitoreo de anomalías de negocio iniciado');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.status.running = false;
    this.emit('stopped');
    console.log('[BusinessAnomalyMonitor] Monitoreo detenido');
  }

  getStatus(): AnomalyMonitorStatus {
    return { ...this.status };
  }

  getConfig(): AnomalyMonitorConfig {
    return { ...this.config };
  }

  // Métodos compatibles con el plan original para evitar romper integraciones existentes
  startMonitor = (whatsappClient: any) => {
    this.setWhatsAppClient(whatsappClient);
    this.start();
  };

  stopMonitor = () => {
    this.stop();
  };

  /**
   * Revisa si hay reuniones inminentes y verifica el estado de los archivos locales relacionados
   */
  private async checkAnomalies(): Promise<void> {
    this.status.lastCheck = new Date();
    
    try {
      const events = await this.getUpcomingMeetings();
      
      for (const event of events) {
        // Evitar alertar múltiples veces sobre el mismo evento
        if (event.id && this.notifiedEvents.has(event.id)) continue;

        if (event.timeToStart > 0 && event.timeToStart < this.config.alertThresholdMs) {
          const clientName = this.extractClientName(event.title);
          if (!clientName) continue;

          let projectDir = '';
          try {
            const dirs = await fs.readdir(this.config.projectsDir!);
            const matchedDir = dirs.find(d => d.toLowerCase().includes(clientName.toLowerCase()));
            if (matchedDir) {
              projectDir = path.join(this.config.projectsDir!, matchedDir);
            }
          } catch (e) {
            // El directorio base de proyectos podría no existir, fallamos silenciosamente para este chequeo
            continue;
          }

          if (projectDir) {
            let files: string[] = [];
            try {
              files = await fs.readdir(projectDir);
            } catch(e) { 
              continue;
            }
            
            // Buscar si hay alguna presentación
            const hasPresentation = files.some(f => 
              f.toLowerCase().includes('.ppt') || 
              f.toLowerCase().includes('.pdf') || 
              f.toLowerCase().includes('.key') ||
              f.toLowerCase().includes('presentacion') ||
              f.toLowerCase().includes('presentation')
            );
            
            if (!hasPresentation) {
              this.status.anomaliesDetected++;
              this.emit('anomaly-detected', { event, clientName, projectDir });
              
              const alertMsg = `💡 *Alerta Proactiva*: Tienes una reunión sobre "${event.title}" en menos de 2 horas. Revisé la carpeta local "${clientName}" y no detecté archivos de presentación (PPT/PDF) recientes. ¿Deseas que genere un esquema automático de apoyo para la reunión?`;
              
              if (this.whatsappClient) {
                try {
                  if (typeof this.whatsappClient.sendMessage === 'function') {
                    await this.whatsappClient.sendMessage(alertMsg);
                  } else if (typeof this.whatsappClient.sendText === 'function') {
                    // Si usa el formato de waService, emitimos para que el main lo envíe
                    this.emit('notify-whatsapp', { message: alertMsg });
                  }
                } catch (err: any) {
                  console.error('[BusinessAnomalyMonitor] Error enviando alerta de WhatsApp:', err.message);
                }
              } else {
                // Si no hay cliente inyectado, se confía en el evento emitido
                this.emit('notify-whatsapp', { message: alertMsg });
              }

              if (event.id) {
                this.notifiedEvents.add(event.id);
                // Limpiar la memoria cacheada después de que pase el evento (tiempo hasta inicio + 1 hora extra)
                setTimeout(() => this.notifiedEvents.delete(event.id), event.timeToStart + 3600000);
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[BusinessAnomalyMonitor] Error en checkAnomalies:', e.message);
    }
  }

  /**
   * Obtiene eventos del calendario inyectado o devuelve lista vacía si no hay
   */
  private async getUpcomingMeetings(): Promise<any[]> {
    if (this.calendarService && typeof this.calendarService.getCurrentEvents === 'function') {
      try {
        const events = await this.calendarService.getCurrentEvents(new Date());
        const now = new Date().getTime();
        
        return events.map((e: any) => ({
          id: e.id || Math.random().toString(36).substring(7),
          title: e.title,
          timeToStart: new Date(e.start).getTime() - now,
          start: e.start
        }));
      } catch (err: any) {
        console.error('[BusinessAnomalyMonitor] Error obteniendo eventos del calendario:', err.message);
      }
    }
    return []; 
  }

  /**
   * Heurística para extraer el nombre del cliente/proyecto del título de la reunión
   */
  private extractClientName(title: string): string | null {
    if (!title) return null;
    const lowerTitle = title.toLowerCase();
    
    // Patrones comunes: "Reunión con ClienteX", "Sync: ProyectoY", etc.
    const match = lowerTitle.match(/(?:con|with|:|para|for|-)\s+([a-zA-Z0-9\s]+)/i);
    if (match && match[1]) {
      const words = match[1].trim().split(/\s+/);
      return words.slice(0, 3).join(' ').trim();
    }
    
    // Si no hay patrón claro, limpiamos palabras genéricas
    const stripped = title.replace(/reunión|meeting|sync|call|review|entrevista/ig, '').trim();
    return stripped.length > 2 ? stripped : null;
  }
}
