import type { DailyBriefingSystemData } from './types';

export function buildDailyBriefingPrompt(systemData: DailyBriefingSystemData): string {
  return `
Genera un "Resumen Ejecutivo" matutino muy breve y motivador para el usuario, basado en la siguiente informacion del sistema.
Actua como Pulse, el sistema operativo de IA.
Instrucciones:
1. Da los buenos dias y menciona la fecha.
2. Proporciona un resumen rapido del estado del sistema de forma amigable.
3. Ofrece ayuda proactiva para organizar su dia, calendario, emails o proyectos.
4. Usa formato limpio apto para WhatsApp y evita tablas.
5. Se conciso: no superes los 3 parrafos cortos.

Datos del sistema actual:
${systemData.formatted}
`;
}

export function buildFallbackBriefing(systemData: DailyBriefingSystemData): string {
  return [
    `Buenos dias. Hoy es ${systemData.dateStr}.`,
    '',
    'Tuve un problema conectando con mi motor cognitivo, pero el sistema esta funcional.',
    `Diagnostico rapido: Memoria RAM: ${systemData.freeMem} GB libres.`,
    '',
    'En que te puedo ayudar hoy para que sea un gran dia?',
  ].join('\n');
}
