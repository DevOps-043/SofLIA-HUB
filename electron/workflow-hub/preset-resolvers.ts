/**
 * Resolvers de presets predefinidos para los workflows.
 *
 * Centralizan los valores hardcodeados de queries Gmail y plantillas Drive
 * que el Hub usa por defecto. Si se agregan nuevos presets, este es el
 * único lugar a tocar.
 */

/**
 * Convierte un preset de Gmail (atajo legible) a la query real que entiende
 * el API de Gmail. Cubre los preset names usados por el workflow `correo`.
 */
export function resolveMailPresetQuery(preset: string): string {
  switch (preset) {
    case 'today':
      return 'in:inbox newer_than:1d';
    case 'priority':
      return 'in:inbox category:primary newer_than:7d';
    case 'custom':
      return 'in:inbox newer_than:7d';
    case 'unread':
    default:
      return 'in:inbox is:unread newer_than:7d';
  }
}

/**
 * Devuelve la lista de subcarpetas a crear según el template de proyecto
 * Drive. Los templates están alineados con las carpetas estándar usadas
 * por el equipo de PulseHub.
 */
export function resolveDriveFolderPreset(preset: string): Array<Record<string, unknown>> {
  switch (preset) {
    case 'proyecto_simple':
      return [
        { name: '01 Alcance' },
        { name: '02 Operacion' },
        { name: '03 Entregables' },
      ];
    case 'operacion':
      return [
        { name: '01 Operacion diaria' },
        { name: '02 Reportes' },
        { name: '03 Incidencias' },
        { name: '04 Evidencias' },
      ];
    case 'cliente_estandar':
    default:
      return [
        { name: '01 Direccion' },
        { name: '02 Operacion' },
        { name: '03 Comercial' },
        { name: '04 Entregables' },
        { name: '05 Finanzas' },
      ];
  }
}
