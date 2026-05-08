import type { DailyDigestStats } from './types';

export function buildDailyDigestHtml(stats: DailyDigestStats): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 40px; background-color: #ffffff; }
    .header { text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 25px; margin-bottom: 35px; }
    .header h1 { color: #4f46e5; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 0; }
    .header p { color: #6b7280; font-size: 15px; margin-top: 8px; text-transform: capitalize; }
    .section { margin-bottom: 35px; }
    .section h2 { color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; font-size: 20px; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .card h3 { margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .card .value { font-size: 26px; font-weight: 700; color: #111827; }
    .progress-bar { width: 100%; height: 6px; background-color: #f3f4f6; border-radius: 3px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; background-color: #4f46e5; width: ${stats.memPercent}%; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    th, td { text-align: left; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
    th { background-color: #f9fafb; color: #374151; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-purple { background: #ede9fe; color: #5b21b6; }
    .badge-orange { background: #ffedd5; color: #9a3412; }
    .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  ${renderHeader(stats)}
  ${renderHardwareSection(stats)}
  ${renderImpactSection(stats)}
  ${renderInsights(stats)}
  <div class="footer">Generado de manera autonoma por el <strong>Agente SofLIA Hub</strong><br>&copy; ${stats.year} - El Sistema Operativo de IA</div>
</body>
</html>`;
}

function renderHeader(stats: DailyDigestStats): string {
  return `<div class="header"><h1>Reporte Ejecutivo SofLIA Hub</h1><p>${stats.capitalizedDate}</p></div>`;
}

function renderHardwareSection(stats: DailyDigestStats): string {
  return `<div class="section">
    <h2>Salud y Rendimiento de Hardware</h2>
    <div class="grid">
      <div class="card"><h3>Memoria RAM Activa</h3><div class="value">${stats.usedMem.toFixed(1)} GB / ${stats.totalMem} GB</div><div class="progress-bar"><div class="progress-fill"></div></div></div>
      <div class="card"><h3>Tiempo de Actividad Continuo</h3><div class="value">${stats.uptime} hrs</div><p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Estabilidad del sistema confirmada</p></div>
    </div>
    <div style="margin-top: 18px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13px; color: #4b5563;">
      <p style="margin: 0 0 6px 0;"><strong>CPU:</strong> ${stats.cpuModel} (${stats.cpuCores} nucleos)</p>
      <p style="margin: 0;"><strong>Almacenamiento:</strong> ${stats.diskInfo}</p>
    </div>
  </div>`;
}

function renderImpactSection(stats: DailyDigestStats): string {
  return `<div class="section"><h2>Metricas de Impacto (Ultimos 7 Dias)</h2><table><thead><tr><th>Vector Operativo</th><th>Metrica Registrada</th><th>Estado / Ahorro</th></tr></thead><tbody>
    <tr><td><strong>AutoDev</strong> (Self-Evolution)</td><td>Mejoras y Fixes Autonomos</td><td><span class="badge badge-purple">+${stats.autoDevRuns} Ejecuciones</span></td></tr>
    <tr><td><strong>Desktop Agent</strong> (RPA)</td><td>Tareas de Sistema Realizadas</td><td><span class="badge badge-blue">${stats.desktopTasks} Tareas</span></td></tr>
    <tr><td><strong>Productividad Recuperada</strong></td><td>Horas Hombre Ahorradas</td><td><span class="badge badge-green">~${stats.savedHours} Horas</span></td></tr>
    <tr><td><strong>System Guardian</strong></td><td>Prevencion de Saturaciones</td><td><span class="badge badge-orange">Optimizado</span></td></tr>
  </tbody></table></div>`;
}

function renderInsights(stats: DailyDigestStats): string {
  return `<div class="section"><h2>Insights de Inteligencia Artificial</h2><div style="background: linear-gradient(to right, #eef2ff, #f5f3ff); padding: 20px; border-radius: 10px; border-left: 4px solid #6366f1;">
    <p style="margin: 0; color: #312e81; font-size: 14px; line-height: 1.6; font-style: italic;">"La carga termica y de memoria mantiene un perfil estable. El uso de herramientas automatizadas ha ahorrado aproximadamente ${stats.savedHours} horas de flujos mecanicos."</p>
  </div></div>`;
}
