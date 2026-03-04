import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import util from 'node:util';

const execFileAsync = util.promisify(execFile);

export interface AutoBackupConfig {
  sourceDirs: string[];
  outputDir: string;
  intervalDays?: number; // Configuración del intervalo en días, por defecto 7
  prefix?: string; // Prefijo del archivo generado, ej: 'soflia_backup'
}

export interface BackupStatus {
  isBackingUp: boolean;
  lastBackupDate?: Date;
  lastBackupSize?: number;
  lastBackupPath?: string;
  error?: string;
  nextBackupDate?: Date;
}

/**
 * Servicio de Backup Inteligente automático en segundo plano.
 * Se encarga de respaldar directorios críticos del usuario de forma programada,
 * comprimiéndolos al máximo para ahorrar espacio e informando proactivamente.
 * Implementado con herramientas nativas del SO para evitar dependencias externas.
 */
export class AutoBackupService extends EventEmitter {
  private config: AutoBackupConfig;
  private intervalId?: NodeJS.Timeout;
  private status: BackupStatus;

  constructor(config: AutoBackupConfig) {
    super();
    this.config = {
      ...config,
      intervalDays: config.intervalDays || 7,
      prefix: config.prefix || 'soflia_backup'
    };
    this.status = {
      isBackingUp: false
    };
  }

  /**
   * Inicializa el servicio, asegurando que el directorio de destino exista.
   */
  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }
      this.emit('initialized', { config: this.config });
    } catch (error: any) {
      this.emit('error', new Error(`Error al inicializar AutoBackupService: ${error.message}`));
    }
  }

  /**
   * Inicia la programación automática del respaldo en base a los días configurados.
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      await this.stop();
    }
    
    const days = this.config.intervalDays!;
    const msInterval = days * 24 * 60 * 60 * 1000;
    
    this.updateNextBackupDate(msInterval);

    this.intervalId = setInterval(() => {
      this.runScheduledBackup();
    }, msInterval);

    this.emit('started', { intervalDays: days, nextBackupDate: this.status.nextBackupDate });
  }

  /**
   * Detiene las tareas automáticas de respaldo programadas.
   */
  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.status.nextBackupDate = undefined;
      this.emit('stopped');
    }
  }

  /**
   * Obtiene el estado actual de los respaldos (en progreso, último respaldo, errores).
   */
  getStatus(): BackupStatus {
    return this.status;
  }

  /**
   * Obtiene la configuración actual del servicio.
   */
  getConfig(): AutoBackupConfig {
    return this.config;
  }

  /**
   * Agrega dinámicamente un nuevo directorio a la lista de respaldos.
   */
  addSourceDirectory(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) {
      return false;
    }
    
    if (!this.config.sourceDirs.includes(dirPath)) {
      this.config.sourceDirs.push(dirPath);
      this.emit('config-updated', this.config);
      return true;
    }
    return false;
  }

  /**
   * Remueve un directorio de la lista de respaldos automatizados.
   */
  removeSourceDirectory(dirPath: string): boolean {
    const initialLength = this.config.sourceDirs.length;
    this.config.sourceDirs = this.config.sourceDirs.filter(d => d !== dirPath);
    
    if (this.config.sourceDirs.length < initialLength) {
      this.emit('config-updated', this.config);
      return true;
    }
    return false;
  }

  /**
   * Cambia la frecuencia del respaldo automático y reinicia el ciclo.
   */
  updateInterval(days: number): void {
    if (days <= 0) throw new Error('El intervalo debe ser mayor a 0 días');
    
    this.config.intervalDays = days;
    this.emit('config-updated', this.config);
    
    // Si estaba corriendo, reiniciar el timer para aplicar la nueva frecuencia
    if (this.intervalId) {
      this.start();
    }
  }

  /**
   * Método interno para invocar el respaldo en base al cron/interval.
   */
  private async runScheduledBackup(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const isWin = process.platform === 'win32';
      const ext = isWin ? 'zip' : 'tar.gz';
      const filename = `${this.config.prefix}_${timestamp}.${ext}`;
      const fullPath = path.join(this.config.outputDir, filename);
      
      await this.createBackup(this.config.sourceDirs, fullPath);
      
      // Actualizar la próxima fecha de respaldo luego de completarse este
      const days = this.config.intervalDays || 7;
      const msInterval = days * 24 * 60 * 60 * 1000;
      this.updateNextBackupDate(msInterval);
      
    } catch (err: any) {
      this.emit('error', new Error(`Fallo en el respaldo programado: ${err.message}`));
    }
  }

  /**
   * Actualiza el registro en el estado de cuándo es el próximo respaldo.
   */
  private updateNextBackupDate(msInterval: number): void {
    const nextDate = new Date(Date.now() + msInterval);
    this.status.nextBackupDate = nextDate;
  }

  /**
   * Crea un archivo comprimido nativo con el contenido de los directorios fuente especificados.
   * Usa PowerShell en Windows y tar en Linux/Mac para evitar dependencias externas como 'archiver'.
   */
  public async createBackup(sourceDirs: string[], outputPath: string): Promise<void> {
    if (this.status.isBackingUp) {
      throw new Error('Un respaldo ya está en progreso.');
    }

    if (sourceDirs.length === 0) {
      throw new Error('No hay directorios fuente especificados para el respaldo.');
    }

    this.status.isBackingUp = true;
    this.status.error = undefined;
    this.emit('backup-started', { sourceDirs, outputPath });

    try {
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const validSourceDirs = sourceDirs.filter(dir => {
        if (!fs.existsSync(dir)) {
          this.emit('warning', `El directorio ${dir} no existe, se omitirá en el respaldo.`);
          return false;
        }
        return true;
      });

      if (validSourceDirs.length === 0) {
        throw new Error('Ninguno de los directorios fuente especificados existe en el sistema.');
      }

      let executable = '';
      let args: string[] = [];

      if (process.platform === 'win32') {
        const isZip = outputPath.toLowerCase().endsWith('.zip');
        if (!isZip) outputPath += '.zip';
        
        // Escapar comillas simples duplicándolas para PowerShell
        const pathsArg = validSourceDirs.map(d => `'${d.replace(/'/g, "''")}'`).join(', ');
        const psCommand = `Compress-Archive -Path ${pathsArg} -DestinationPath '${outputPath.replace(/'/g, "''")}' -Force`;
        
        executable = 'powershell.exe';
        args = ['-NoProfile', '-NonInteractive', '-Command', psCommand];
      } else {
        const isTarGz = outputPath.toLowerCase().endsWith('.tar.gz');
        if (!isTarGz) outputPath += '.tar.gz';
        
        executable = 'tar';
        // Pasar los argumentos de forma segura evitando la shell por completo
        args = ['-czf', outputPath, ...validSourceDirs];
      }

      // Ejecutar el comando nativo de forma segura usando execFile y un arreglo de argumentos
      await execFileAsync(executable, args, { maxBuffer: 1024 * 1024 * 50 });

      // Comprobar la creación exitosa del archivo
      if (!fs.existsSync(outputPath)) {
        throw new Error('El archivo de respaldo no fue creado por el comando del sistema.');
      }

      const stats = fs.statSync(outputPath);
      const sizeBytes = stats.size;
      const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
      
      this.status.isBackingUp = false;
      this.status.lastBackupDate = new Date();
      this.status.lastBackupSize = sizeBytes;
      this.status.lastBackupPath = outputPath;
      
      const successMessage = `✅ Respaldo completado exitosamente.\n📁 Ruta: ${outputPath}\n📦 Tamaño: ${sizeMB} MB`;
      
      this.emit('backup-completed', {
        path: outputPath,
        sizeBytes,
        sizeMB: Number(sizeMB),
        message: successMessage
      });
      
      this.emit('system-notification', {
        title: 'Respaldo Automático',
        body: successMessage,
        type: 'success'
      });

    } catch (err: any) {
      this.status.isBackingUp = false;
      this.status.error = err.message || 'Error desconocido al crear el respaldo';
      this.emit('error', new Error(`Fallo en el respaldo: ${err.message}`));
      throw err;
    }
  }
}
