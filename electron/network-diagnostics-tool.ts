import * as si from 'systeminformation';
import { z } from 'zod';

export const networkDiagnosticsTool = {
  name: 'network_diagnostics',
  description: 'Diagnostica la red local y conectividad de internet obteniendo IP, latencia y tráfico Rx/Tx.',
  schema: z.object({ action: z.literal('diagnose') }) as any,
  execute: async () => {
    try {
      const [interfacesData, latency, statsData] = await Promise.all([
        si.networkInterfaces(),
        si.inetLatency(),
        si.networkStats()
      ]);

      const interfaces = Array.isArray(interfacesData) ? interfacesData : [interfacesData];
      const stats = Array.isArray(statsData) ? statsData : [statsData];

      const activeInterfaces = interfaces.filter(
        (iface: any) => iface.ip4 && iface.ip4 !== '127.0.0.1' && iface.operstate === 'up'
      );

      const activeIf = activeInterfaces.length > 0 ? activeInterfaces[0] : null;
      const ip = activeIf ? activeIf.ip4 : 'Desconocida';

      let rxBytes = 0;
      let txBytes = 0;

      if (activeIf) {
        const activeStats = stats.find((s: any) => s.iface === activeIf.iface);
        if (activeStats) {
          rxBytes = activeStats.rx_bytes || 0;
          txBytes = activeStats.tx_bytes || 0;
        }
      }

      const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return `🌐 *Diagnóstico de Red*\n\n📡 IP Local: ${ip}\n⚡ Latencia: ${latency}ms\n⬇️ Rx: ${formatBytes(rxBytes)}\n⬆️ Tx: ${formatBytes(txBytes)}`;
    } catch (error: any) {
      throw new Error(`Error en diagnóstico de red: ${error.message}`);
    }
  }
};
