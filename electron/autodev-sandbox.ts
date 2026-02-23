import { Worker } from 'worker_threads';

export interface ValidationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export class AutodevSandbox {
  private timeoutMs: number;

  constructor(timeoutMs: number = 5000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Ejecuta un chequeo previo del código en un worker aislado.
   * Evalúa la sintaxis y dependencias cruzadas sin afectar el proceso principal.
   * 
   * @param code Código fuente a validar.
   * @returns Un objeto con el resultado, incluyendo el estado de éxito y los logs capturados.
   */
  async runPreflightCheck(code: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // Crear worker aislado evaluando el código directamente como string.
      // Habilitar stdout y stderr de forma nativa para interceptar la salida.
      const worker = new Worker(code, {
        eval: true,
        stdout: true,
        stderr: true,
      });

      // Capturar logs de la salida estándar
      worker.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      // Capturar logs de error
      worker.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      // Establecer un timeout para matar el worker si se detecta un bucle infinito o proceso largo
      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          worker.terminate(); // Matar forzosamente el worker
          resolve({
            success: false,
            stdout,
            stderr,
            error: `Timeout: La ejecución del código excedió el límite de tiempo permitido (${this.timeoutMs}ms).`,
          });
        }
      }, this.timeoutMs);

      // Manejar excepciones de compilación/sintaxis o errores de ejecución
      worker.on('error', (err: Error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve({
            success: false,
            stdout,
            stderr,
            error: err.message || String(err),
          });
        }
      });

      // Manejar la finalización del hilo, exitCode = 0 indica éxito
      worker.on('exit', (exitCode: number) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          
          if (exitCode !== 0) {
            resolve({
              success: false,
              stdout,
              stderr,
              error: `Worker finalizó de manera anormal con código de salida ${exitCode}`,
            });
          } else {
            resolve({
              success: true,
              stdout,
              stderr,
            });
          }
        }
      });
    });
  }
}
