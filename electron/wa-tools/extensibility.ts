/**
 * Tools de extensibilidad: dynamic toolsets (plugin system) + creación de documentos.
 */

export const EXTENSIBILITY_TOOLS = [
  {
    name: 'list_dynamic_tools',
    description: 'Lista las herramientas dinámicas actualmente cargadas por SofLIA desde sus rutas de descubrimiento (workspace y toolsets instalados en userData). Útil para inspeccionar capacidades nuevas estilo plugin.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'list_installable_toolsets',
    description: 'Lista los toolsets dinámicos instalables estilo plugin que SofLIA puede agregar para nuevas integraciones.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'list_installed_toolsets',
    description: 'Lista los toolsets dinámicos ya instalados por SofLIA junto con sus variables de entorno requeridas.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'doctor_dynamic_toolsets',
    description: 'Diagnostica los toolsets dinámicos instalados: archivos presentes, tools realmente cargadas y variables de entorno faltantes.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'install_dynamic_toolset',
    description: 'Instala o actualiza un toolset dinámico por id. Usa esto cuando falte una integración que SofLIA puede agregar en caliente. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        toolset_id: { type: 'STRING' as const, description: 'ID del toolset a instalar. Ejemplo: "home-assistant".' },
      },
      required: ['toolset_id'],
    },
  },
  {
    name: 'uninstall_dynamic_toolset',
    description: 'Desinstala un toolset dinámico administrado por su id y elimina sus archivos generados. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        toolset_id: { type: 'STRING' as const, description: 'ID del toolset a desinstalar. Ejemplo: "home-assistant".' },
      },
      required: ['toolset_id'],
    },
  },
  {
    name: 'install_home_assistant_toolset',
    description: 'Atajo para instalar el toolset dinámico de Home Assistant con tools para listar estados, obtener una entidad y ejecutar servicios como encender/apagar luces. REQUIERE confirmación.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'create_document',
    description: 'Crea un documento profesional. Para PRESENTACIONES usa type:"pptx" (se genera como PDF con diseño de slides premium). Proporciona slides_json con slides tipados y custom_theme con colores/fuentes generados según el contexto. SIEMPRE después de crear el documento, envíalo con whatsapp_send_file.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        type: { type: 'STRING' as const, description: '"word" para Word (.docx), "excel" para Excel (.xlsx), "pdf" para PDF (.pdf), "pptx" o "presentacion" para Presentación con slides (se genera como PDF con diseño premium), o "md" para Markdown (.md).' },
        filename: { type: 'STRING' as const, description: 'Nombre del archivo sin extensión.' },
        content: { type: 'STRING' as const, description: 'Para word/pdf/md: contenido en Markdown con ## para encabezados, **bold**, *italic*, listas, tablas. Para excel: JSON [{"Col1":"val"},...]. Para pptx: si no se proporciona slides_json, se parseará este contenido como Markdown (fallback).' },
        slides_json: { type: 'STRING' as const, description: 'SOLO para pptx. JSON array de SlideData con tipos variados. 15 TIPOS DISPONIBLES: title, content, two-column, image-focus, quote, section-break, comparison, closing, infographic, flowchart, data-table, stats, timeline, process, icon-grid. NUEVOS CAMPOS: items (para infographic/icon-grid): [{icon:"emoji",label:"...",description:"...",color:"hex"}], steps (para flowchart/timeline/process): [{label:"...",description:"..."}], tableData (para data-table): {headers:["..."],rows:[["..."]...]}, stats (para stats): [{value:"$1.2M",label:"Ventas",trend:"+15%"}]. Cada slide PUEDE incluir imagePrompt y/o diagramPrompt.' },
        custom_theme: { type: 'STRING' as const, description: 'SOLO para pptx. JSON con tema visual GENERADO DINÁMICAMENTE según el contexto. Estructura: {"colors":{"bg":"hex sin #","bgAlt":"hex","accent":"hex","accentAlt":"hex","text":"hex","textMuted":"hex","heading":"hex","scrim":"hex","scrimOpacity":55},"fontHeading":"nombre fuente","fontBody":"nombre fuente"}. Genera colores que reflejen el tema: naturaleza→verdes, tecnología→azules/neón, salud→turquesa, negocios→azul marino, etc. SIEMPRE genera este campo para pptx.' },
        include_images: { type: 'BOOLEAN' as const, description: 'Para pptx: si true, genera imágenes AI para cada diapositiva. Default: true.' },
        save_directory: { type: 'STRING' as const, description: 'Carpeta donde guardar. Si no se especifica, se guarda en el escritorio del usuario.' },
        title: { type: 'STRING' as const, description: 'Título principal del documento.' },
      },
      required: ['type', 'filename', 'content'],
    },
  },
];
