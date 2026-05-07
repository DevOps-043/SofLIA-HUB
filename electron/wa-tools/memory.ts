/**
 * Tools de memoria, knowledge base y búsqueda contextual.
 *
 * Cubre:
 *  - Lecciones aprendidas (`save_lesson`, `recall_memories`)
 *  - Knowledge base estilo OpenClaw (`knowledge_*`)
 *  - Búsqueda en historial de portapapeles (`search_clipboard_history`)
 *  - Búsqueda semántica de archivos por contenido (`semantic_file_search`)
 */

export const MEMORY_TOOLS = [
  {
    name: 'save_lesson',
    description: 'Guarda una lección aprendida para no repetir el mismo error en el futuro. Úsalo cuando el usuario te corrija o cuando descubras algo importante (como una ruta correcta, una preferencia, etc.).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        lesson: { type: 'STRING' as const, description: 'La lección o dato a recordar. Ej: "El escritorio del usuario está en C:\\Users\\fysg5\\OneDrive\\Escritorio"' },
        context: { type: 'STRING' as const, description: 'Contexto breve de por qué se aprendió esto.' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'recall_memories',
    description: 'Consulta todas las lecciones aprendidas previamente. Úsalo al inicio de tareas para recordar preferencias y errores pasados.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'knowledge_save',
    description: 'Guarda información importante en la base de conocimiento persistente (MEMORY.md). Usa esto para guardar datos duraderos: preferencias del usuario, decisiones, configuraciones, datos del sistema, etc. Esta información se inyecta SIEMPRE en cada conversación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        content: { type: 'STRING' as const, description: 'El dato o conocimiento a guardar. Sé conciso y claro.' },
        section: { type: 'STRING' as const, description: 'Sección donde guardar. Opciones: "Preferencias Generales", "Lecciones Aprendidas", "Decisiones Arquitectónicas", "Datos del Sistema". También puedes crear secciones nuevas.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'knowledge_update_user',
    description: 'Actualiza el perfil del usuario actual con información personal, preferencias o contexto laboral. Estos datos se inyectan automáticamente en cada conversación con este usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        section: { type: 'STRING' as const, description: 'Sección del perfil: "Datos Personales", "Preferencias de Comunicación", "Contexto Laboral", "Notas Importantes".' },
        content: { type: 'STRING' as const, description: 'La información a guardar en esa sección del perfil.' },
      },
      required: ['section', 'content'],
    },
  },
  {
    name: 'knowledge_search',
    description: 'Busca información en toda la base de conocimiento (MEMORY.md, perfiles de usuario, logs diarios). Usa esto para recordar conversaciones pasadas, buscar datos guardados previamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Texto a buscar en los archivos de conocimiento.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_log',
    description: 'Registra un evento o contexto en el log diario (memory/YYYY-MM-DD.md). Usa esto para eventos temporales, resúmenes de sesión, acciones realizadas. Los logs diarios NO se inyectan automáticamente — se consultan con knowledge_search.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        content: { type: 'STRING' as const, description: 'El evento o contexto a registrar.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'knowledge_read',
    description: 'Lee el contenido de un archivo de conocimiento específico. Archivos disponibles: "MEMORY.md", "users/{phone}.md", "memory/YYYY-MM-DD.md".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        file: { type: 'STRING' as const, description: 'Nombre del archivo a leer (ej: "MEMORY.md", "memory/2026-02-21.md").' },
      },
      required: ['file'],
    },
  },
  {
    name: 'search_clipboard_history',
    description: 'Busca inteligentemente en el historial reciente de textos copiados al portapapeles. Útil si el usuario pide "el link que copié", "la contraseña que copié hace rato", "el correo que estaba viendo".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Descripción en lenguaje natural de lo que se busca (ej: "el link de zoom", "la contraseña del wifi").' },
      },
      required: ['query'],
    },
  },
  {
    name: 'semantic_file_search',
    description: 'Busca archivos olvidados en la computadora por su CONTENIDO o descripción natural usando búsqueda semántica FTS5. Ideal para recuperar documentos cuando el usuario no recuerda el nombre (ej: "el reporte de ventas de marzo", "el contrato de arrendamiento").',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Frase, palabras clave o tema a buscar dentro del contenido de los documentos.' },
        max_results: { type: 'NUMBER' as const, description: 'Máximo de resultados (por defecto 3).' },
      },
      required: ['query'],
    },
  },
];
