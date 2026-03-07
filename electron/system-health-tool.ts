import * as os from 'node:os';
import { z } from 'zod';

// 7. Exportar schema Zod sin parámetros requeridos
export const systemHealthSchema = z.object({});

/**
 * Calcula el porcentaje de uso actual de la CPU tomando una muestra de 100ms.
 * (os.cpus() retorna el tiempo desde el arranque, por lo que se requiere una delta).
 */
function getCpuUsage(): Promise<string> {
  return new Promise((resolve) => {
    const startCpus = os.cpus();
    
    setTimeout(() => {
      const endCpus = os.cpus();
      let idleDifference = 0;
      let totalDifference = 0;

      // 4. Calcular carga de CPU iterando sobre los tiempos
      for (let i = 0; i < startCpus.length; i++) {
        const start = startCpus[i];
        const end = endCpus[i];
        
        let startTotal = 0;
        for (const type in start.times) {
          startTotal += start.times[type as keyof typeof start.times];
        }
        
        let endTotal = 0;
        for (const type in end.times) {
          endTotal += end.times[type as keyof typeof end.times];
        }
        
        totalDifference += (endTotal - startTotal);
        idleDifference += (end.times.idle - start.times.idle);
      }

      const cpuUsagePercent = totalDifference === 0 ? 0 : 100 - (100 * idleDifference / totalDifference);
      resolve(cpuUsagePercent.toFixed(1));
    }, 100);
  });
}

/**
 * 2. Implementar async function getSystemHealth()
 * Genera un reporte resumido y ejecutivo del estado actual del sistema (salud del PC).
 */
export async function getSystemHealth(): Promise<string> {
  try {
    // 3. Calcular memoria libre y total
    const totalRAM = os.totalmem();
    const freeRAM = os.freemem();
    const usedRAM = totalRAM - freeRAM;
    const ramUsagePercent = ((usedRAM / totalRAM) * 100).toFixed(1);
    const totalRAM_GB = (totalRAM / (1024 * 1024 * 1024)).toFixed(2);
    const usedRAM_GB = (usedRAM / (1024 * 1024 * 1024)).toFixed(2);

    // 4. Calcular carga de CPU
    const cpuUsagePercent = await getCpuUsage();
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Desconocido';

    // 5. Obtener el Uptime del sistema
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days}d `;
    if (hours > 0) uptimeStr += `${hours}h `;
    uptimeStr += `${minutes}m`;

    // 6. Formatear la información en un resumen ejecutivo
    const resumen = [
      `📊 **Estado del Sistema:**`,
      `- **RAM:** ${ramUsagePercent}% en uso (${usedRAM_GB}GB / ${totalRAM_GB}GB)`,
      `- **CPU:** ${cpuUsagePercent}% en uso (${cpus.length} núcleos - ${cpuModel})`,
      `- **Uptime:** ${uptimeStr || 'Menos de 1 minuto'}`,
      `- **SO:** ${os.platform()} ${os.release()} (${os.arch()})`
    ].join('\n');

    return resumen;
  } catch (error: any) {
    return `Error al obtener el estado del sistema: ${error.message}`;
  }
}

// Estructura de herramienta para integración con agentes (ej. WhatsApp/AutoDev)
export const systemHealthToolDeclaration = {
  name: 'system_health_telemetry',
  description: 'Telemetría de Bolsillo: monitoreo de salud del PC (RAM, CPU, Uptime)',
  parameters: systemHealthSchema,
  execute: async () => {
    return await getSystemHealth();
  }
};
