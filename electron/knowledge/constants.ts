import { app } from 'electron';
import path from 'node:path';

export const KNOWLEDGE_DIR = path.join(app.getPath('userData'), 'knowledge');
export const USERS_DIR = path.join(KNOWLEDGE_DIR, 'users');
export const DAILY_DIR = path.join(KNOWLEDGE_DIR, 'memory');
export const MEMORY_FILE = path.join(KNOWLEDGE_DIR, 'MEMORY.md');
export const PATHS_FILE = path.join(KNOWLEDGE_DIR, 'PATHS.md');
export const BOOTSTRAP_MAX_CHARS = 15000;
export const BOOTSTRAP_TOTAL_MAX_CHARS = 25000;

export const DEFAULT_MEMORY = `# Pulse - Memoria Persistente

## Preferencias Generales
<!-- Preferencias que aplican a todos los usuarios -->

## Lecciones Aprendidas
<!-- Correcciones y errores que no debo repetir -->

## Decisiones Arquitectonicas
<!-- Decisiones tecnicas importantes del sistema -->

## Datos del Sistema
<!-- Informacion sobre el entorno, rutas, configuraciones -->
`;

export function defaultUserProfile(phoneNumber: string): string {
  return `# Perfil de Usuario: ${phoneNumber}

## Datos Personales
- Telefono: ${phoneNumber}
- Nombre: (pendiente)
- Zona horaria: (pendiente)

## Preferencias de Comunicacion
- Idioma: Espanol
- Estilo: (pendiente)

## Contexto Laboral
<!-- Empresa, rol, proyectos activos -->

## Notas Importantes
<!-- Datos relevantes aprendidos de las conversaciones -->
`;
}
