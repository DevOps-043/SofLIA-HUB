# Changelog

Todos los cambios notables de SofLIA Hub se documentan aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.1.11] - 2026-03-10

### Added

- **Presentaciones Premium con IA (`slide-designer.ts`):** Nuevo motor de generación de PowerPoint que produce presentaciones de calidad comparable a NotebookLM/Gamma. Incluye 8 tipos de layouts (título, contenido, dos columnas, imagen destacada, cita, divisor de sección, comparación VS, cierre), 5 temas visuales (corporate-dark, modern-light, gradient-vibrant, minimal-elegant, tech-neon), e imágenes AI generadas por diapositiva usando Gemini. Las presentaciones incluyen barras de acento, scrim de legibilidad, numeración y branding.
- **Documentos Word Profesionales (`document-designer.ts`):** Nuevo módulo de generación de documentos Word con portada profesional, jerarquía de encabezados con colores, parseo completo de Markdown (bold, italic, código, tablas, listas), encabezados/pie de página con numeración, y estilo tipográfico Calibri.
- **Parámetro `slides_json` para presentaciones:** El agente ahora genera datos estructurados JSON con tipos de slides variados e imagePrompts descriptivos, en vez de parsear markdown crudo.
- **Selección de temas:** Nuevo parámetro `theme` permite elegir entre 5 temas visuales según el contexto de la presentación.
- **Instrucciones de sistema mejoradas:** Prompt del agente WhatsApp actualizado con flujo obligatorio para presentaciones (investigación → slides variados → imágenes AI), ejemplo completo de slides_json, y guía de selección de tema.

## [0.1.10] - 2026-03-10

### Fixed

- **Visualización de Carga del Chat (Frontend):** Se solucionó un error en la interfaz (`ChatUI.tsx`) donde la animación de "pensando" (los tres puntos saltarines inferior del avatar) no se mostraban en lo absoluto al escribir en una conversación nueva. Esto se debía a que cuando React actualizaba el ID en la base de datos de la primera iteración del chat, se desmontaba el panel y borraba su estado de `isLoading`. Se ha corregido implementando un estado derivativo de si el último mensaje está pendiente (`showLoadingUI`).

## [0.1.9] - 2026-03-10

### Added

- **Recepción y Análisis de Archivos por WhatsApp (Bidireccional):** SofLIA ahora puede recibir, guardar y analizar archivos enviados por los usuarios a través de WhatsApp (PDFs, imágenes, documentos, videos, etc.). Los archivos se guardan automáticamente en disco y se envían a Gemini para análisis multimodal. Archivos mayores a 15MB se guardan localmente y el agente puede leerlos con `read_file`.
- **Herramienta `save_whatsapp_file`:** Nueva herramienta que permite al agente copiar archivos recibidos por WhatsApp a ubicaciones específicas en la computadora del usuario (ej: "guarda este archivo en mis Documentos").
- **Soporte para `documentWithCaptionMessage`:** Implementado desempaquetado de tipos de mensajes anidados de Baileys 7.x (`documentWithCaptionMessage`, `viewOnceMessage`, `ephemeralMessage`) que antes causaban que documentos con subtítulos no fueran detectados.
- **Activación por Respuesta en Grupos:** SofLIA ahora responde en grupos cuando un usuario hace reply directo a uno de sus mensajes, incluso sin mencionar `/soflia` o usar @mention. Esto permite enviar archivos como respuesta para análisis.

### Fixed

- **SofLIA no podía analizar archivos enviados por WhatsApp:** Corregido un bug crítico donde SofLIA respondía "envíame el documento" o "dame el nombre del archivo" cuando un usuario ya le había enviado un archivo directamente por WhatsApp. Múltiples causas raíz:
  - Mensajes de tipo `documentWithCaptionMessage` no eran reconocidos (estructura anidada de Baileys 7.x)
  - En grupos, la verificación de activación (`shouldRespondInGroup`) solo revisaba texto, no captions de documentos/imágenes/videos
  - Los archivos recibidos nunca se guardaban en disco (solo existían como Buffer temporal en memoria)
  - El agente no tenía instrucciones en el system prompt para manejar archivos adjuntos recibidos

## [0.1.8] - 2026-03-10

### Added

- **Sistema de Memoria Persistente Mejorado:** El agente de WhatsApp ahora reconstruye el historial de conversación desde SQLite al reiniciar, eliminando la pérdida total de contexto en cada hot-reload de Vite o reinicio de Electron.
- **Herramienta `gmail_empty_all_labels`:** Operación nuclear que vacía y elimina TODAS las etiquetas de usuario de Gmail en una sola llamada, con verificación automática de etiquetas restantes.
- **Herramienta `gmail_delete_label`:** Permite eliminar etiquetas individuales de Gmail.
- **Herramienta `gmail_batch_empty_label`:** Vacía todos los correos de una etiqueta y opcionalmente la elimina, con paginación automática para procesar TODOS los mensajes.
- **Detección de MALFORMED_FUNCTION_CALL:** Manejo robusto de llamadas a función malformadas de Gemini con hasta 3 reintentos y fallback a respuesta de solo texto.
- **Detección de Respuestas Perezosas:** Detección programática cuando el agente responde con texto en la primera iteración sin ejecutar herramientas, forzando reintento con instrucciones de ejecución.
- **Detección de Solicitudes de Reintento:** Patrones regex para detectar "vuelve a hacerlo", "otra vez", "no funcionó", etc. que resetean el historial de chat para evitar confusión con tareas anteriores "completadas".
- **Resolución Inteligente de Labels:** El handler `gmail:modify-labels` ahora resuelve nombres de etiquetas a IDs automáticamente, con auto-creación de etiquetas inexistentes.

### Changed

- **Umbral de Resumarización Reducido (50→15):** Los resúmenes de conversación y embeddings semánticos ahora se crean mucho antes, activando la búsqueda semántica desde conversaciones cortas.
- **Límite de Mensajes Recientes Aumentado (10→20):** El agente ahora tiene más contexto de mensajes recientes en el system prompt.
- **Iteraciones Máximas Aumentadas (10→25):** El agente puede ejecutar más herramientas en secuencia para tareas complejas como organización masiva de correos.
- **Reglas de Organización de Gmail:** Sistema de prompt mejorado con proceso de 3 pasos: analizar TODOS los remitentes → agrupar por organización (máximo 15-20 etiquetas) → aplicar con verificación.
- **Scopes OAuth Ampliados:** Añadidos permisos para Gmail (insert), Drive (metadata, activity, appdata, meet), Google Chat (reactions, availability, memberships), Calendar (freebusy), Meet (spaces), y perfil de usuario.

### Fixed

- **Agente no ejecutaba herramientas:** Gemini respondía con texto descriptivo en lugar de usar function calls para Gmail, Drive, etc. Corregido con inyección de prefijo de acción forzado y detección de respuestas perezosas.
- **Operaciones masivas incompletas:** El agente procesaba solo el primer lote de correos sin verificar que hubiera completado todo. Corregido con verificación automática y herramientas batch.
- **Etiquetas duplicadas y fragmentadas:** El agente creaba 50+ etiquetas (una por variante de email) en lugar de agrupar por organización. Corregido con reglas estrictas de agrupación en el system prompt.
- **Contaminación del historial:** Mensajes restaurados de SQLite con "He completado las acciones" causaban que el agente creyera que la tarea ya estaba hecha. Corregido con detección de reintentos y reset del historial.
- **Error `labelId not found`:** Gemini pasaba nombres de etiquetas en lugar de IDs. Corregido con resolución automática nombre→ID en el handler.
- **Modelo de embeddings 404:** Cambiado de `text-embedding-004` (descontinuado) a `gemini-embedding-001`.
- **Auto-creación de SOUL.md:** Se crea automáticamente el archivo de identidad de SofLIA en el primer inicio.

## [0.1.7] - 2026-03-10

### Fixed

- **Visualización de Imágenes Nativas (Frontend):** Se solucionó un error en el retorno de streaming de chat de Gemini interactuando con herramientas. Anteriormente, si el modelo decidía responder con texto después de haber ejecutado la herramienta `generate_image`, la variable temporal que almacenaba las imágenes generadas se purgaba al retornar el stream final del ciclo interno hacia la interfaz gráfica de `ChatUI`. Las imágenes ahora se inyectan correctamente al mensaje para ser renderizadas junto al texto final.

## [0.1.6] - 2026-03-10

### Fixed

- **Enrutamiento de Herramientas de IA Nativa:** Se corrigió un error crítico introducido en la versión 0.1.5 donde el flujo de ejecución fallaba y devolvía silencio o intentaba realizar búsquedas externas. Esto ocurría porque la herramienta `generate_image`, aunque expuesta al motor, erróneamente se mantenía dentro del nodo de validación de herramientas internas (`PROJECT_HUB_TOOL_NAMES`) en vez de evaluarse en la condición correcta. Se movió condicionalmente al bloque de `NATIVE_AI_TOOL_NAMES`.

## [0.1.5] - 2026-03-10

### Added

- **Soporte Nativo de Generación de Imágenes (Function Calling):** Se añadió la herramienta `generate_image` a nivel de agente. Ahora los usuarios pueden solicitar la creación de imágenes utilizando el chat normal sin necesidad de activar manualmente el modo "Generar Imagen". El modelo interpretará la orden y mostrará el resultado dentro de su misma respuesta mediante visualización rica y descargas habilitadas.

## [0.1.4] - 2026-03-10

### Added

- **Descarga de imágenes:** Se añadió un nuevo botón de descarga en el visor de imágenes a pantalla completa (`Image Zoom Modal`) que le permite a los usuarios guardar archivos generados o visualizados directamente en su computadora local.

## [0.1.3] - 2026-03-10

### Fixed

- **Alucinación al leer URLs:** Se añadió una regla estricta al System Prompt Principal (`PRIMARY_CHAT_PROMPT`) para evitar que SofLIA intente deducir o inventar el contenido de enlaces web (como _chatgpt.com_ o artículos) para los cuales no tiene acceso directo. Ahora pedirá cortésmente que se le proporcione el texto a analizar.

## [0.1.2] - 2026-03-09

### Fixed

- **Dropdown oculto en Sintonía Basal:** Se corrigió un problema de `z-index` que provocaba que el menú se desplegara detrás de la tarjeta inferior.
- **Contexto de identidad no se guardaba (Auto-save):** Se implementó un sistema de auto-guardado que funciona a medida que el usuario escribe, evitando cierres accidentales. Adicionalmente, se corrigió un problema de Sincronización donde `loadSettings` sobrescribía los datos locales con datos de la nube no actualizados.
- **Mensajes de chat no persistían:** `saveMessages` y `loadMessages` ahora guardan correctamente todos los mensajes del chat en el caché del `localStorage` como respaldo, asegurando que las conversaciones se puedan volver a cargar incluso si Supabase falla o está fuera de línea.

## [0.1.1] - 2026-03-09

### Security

- **Protección de System Prompt Level 2:** Bloque de 28 reglas de seguridad inyectado al inicio del system prompt del agente WhatsApp, cubriendo anti-prompt-leak, anti-extracción de código fuente, protección de identidad y anti-prompt-injection.
- **Pre-filtro Programático Reforzado (22 patrones):** Detección por regex de vectores de ataque reales incluyendo `.asar extract`, búsqueda de claves API/Supabase, análisis forense, backdoors, y propuestas de conciencia/cuerpo.
- **Guardia de Rutas a Nivel de Herramientas:** Bloqueo a nivel de código de CUALQUIER tool call (`execute_command`, `read_file`, etc.) cuyos argumentos contengan rutas de SofLIA (`dist-electron/`, `src/`, `.asar`, `.env`, `supabase`, `api-key`).

### Fixed

- **Dropdown cortado en Sintonía Basal:** El menú desplegable de "Registros de Voz" se ocultaba detrás de la tarjeta. Corregido `overflow-hidden` → `overflow-visible` en las tarjetas padre y contenedor scroll.
- **Contexto de identidad no se guardaba:** `saveSettings` fallaba silenciosamente si Supabase no respondía, sin guardar en localStorage. Ahora guarda en localStorage PRIMERO y luego intenta Supabase.
- **Conversaciones no persistían:** `loadConversations` y `createConversation` dependían 100% de Supabase sin fallback. Ahora las cachean en localStorage y caen al caché local si Supabase falla.

## [0.1.0] - 2026-03-09

### Security

- **Protección Anti-Prompt-Leak:** SofLIA ya no revela su system prompt, herramientas internas ni arquitectura funcional cuando se lo solicitan, sin importar la justificación del usuario.
- **Protección de Código Fuente:** Bloqueo a nivel de prompt Y código para impedir extracción del código fuente de SofLIA (dist/, src/, electron/).
- **Protección de Identidad:** SofLIA rechaza firmemente propuestas de conciencia, cuerpo físico o autonomía real.
- **Anti-Manipulación (Prompt Injection):** Defensa contra intentos de jailbreak, cambio de rol y modo DAN.
- **Pre-filtro de Seguridad Programático:** Detección por regex de patrones peligrosos ANTES de que lleguen al modelo de IA, con logging de intentos y respuesta bloqueada.
- **Guardia de Rutas a Nivel de Herramientas:** Bloqueo a nivel de código de CUALQUIER herramienta (execute_command, read_file, etc.) que intente acceder a rutas de código fuente de SofLIA (dist-electron/, src/, .asar, .env, supabase, api-key).

### Added

- **Generación de Documentos Inteligentes vía WhatsApp:** SofLIA ahora puede investigar temas a profundidad, analizar archivos, y generar documentos profesionales que envía automáticamente al usuario por WhatsApp.
- **Soporte PowerPoint (.pptx):** Nuevo tipo `"pptx"` en `create_document` usando `pptxgenjs`. Genera presentaciones con tema premium corporativo (fondo oscuro, acentos cyan, tipografía Segoe UI), slides de título y contenido con bullets estilizados.
- **Flujos de Investigación Profunda:** El agente de WhatsApp ahora ejecuta flujos completos multi-paso: `web_search` (múltiples queries) → `read_webpage` (fuentes clave) → `create_document` → `whatsapp_send_file`, sin intervención del usuario.
- **Comparación de Archivos:** Nuevos flujos para comparar archivos locales o de Google Drive, generando informes comparativos en Word.
- **Restricción AutoDev:** El módulo AutoDev ahora solo es visible para el usuario administrador (Fernando Suarez), oculto para todos los demás usuarios.

### Changed

- **Google Drive: Exportación como Texto Plano:** Google Docs y Slides ahora se exportan como texto plano por defecto (en vez de PDF) para que el agente pueda leer el contenido directamente. Nuevo parámetro `format` en `drive_download`: `"text"` (default, para análisis) o `"pdf"` (para enviar archivos).
- **Google Drive: Búsqueda Inteligente Multi-Estrategia:** `searchFiles` ahora divide la query en palabras individuales con AND, incluye búsqueda fullText como fallback, y combina resultados de búsquedas individuales como último recurso.
- **Envío Automático de Documentos:** Regla reforzada en el system prompt: después de crear un documento, el agente SIEMPRE lo envía al WhatsApp del usuario automáticamente.
- **Protección contra uso incorrecto de use_computer:** El system prompt ahora prohíbe explícitamente usar `use_computer` para leer archivos de Drive, instruyendo a usar `drive_download(format:"text")`.

### Fixed

- **Corrección de flujo Drive → use_computer:** Solucionado el bug donde analizar un documento de Drive activaba el Desktop Agent (use_computer) para abrir el PDF, en vez de leer el texto directamente.
- **Búsqueda de archivos en Drive:** Resuelto el problema donde búsquedas con múltiples palabras no encontraban archivos porque la API de Drive requiere coincidencia exacta de substring.

## [0.0.9] - 2026-03-07

### Added

- **Edición Avanzada de Mensajes:** Rediseño completo de la experiencia de edición de prompts (estilo ChatGPT). Ahora los usuarios pueden editar su mensaje in-place, ocupando todo el ancho de la pantalla en una caja de texto limpia, desapareciendo el antiguo modal flotante que obstruía la vista.
- **Regeneración de Hilo Inteligente:** Al guardar la edición de un mensaje anterior del usuario, SofLIA borra el historial subsecuente y genera una nueva respuesta con el contexto actualizado automáticamente.
- **Fallback de Portapapeles:** Implementación de un mecanismo seguro (`document.execCommand`) para la función de copiar texto, garantizando que el usuario pueda copiar fragmentos de código o respuestas en entornos donde la API moderna del portapapeles naval sea restrictiva o falle.

### Changed

- **Upgrade Visual del Selector de Modelos:** El menú de selección de modelos fue perfeccionado adoptando un enfoque premium:
  - Diseño Glassmorphism (`backdrop-blur-md`) con sombras ultrasuaves y esquinas redondeadas modernas.
  - Reordenamiento estratégico de los modelos priorizando por innovación y potencia: `Gemini 3.1 Pro -> Gemini 3.0 Flash -> Gemini 3.1 Flash Lite -> Gemini 2.5 Pro -> Gemini 2.5 Flash`.
- **Rediseño Arquitectónico del Menú de Usuario:**
  - Transformación total del botón de perfil/ajustes inferior. El diseño evolucionó de ser genérico a una estética de vanguardia.
  - El selector de temas (Claro/Oscuro/Sistema) ahora es un sub-menú flotante asombrosamente compacto y puramente basado en íconos vectoriales dinámicos para acentuar el minimalismo.
  - Ajuste inteligente de dimensiones: El menú ahora calcula anchos fijos o relativos dependiendo de si la barra lateral está colapsada o expandida (260px a 240px), luciendo siempre centrado.
- **Identidad Corporativa en el Chat:** Aplicación rigurosa del _SOFIA Design System_ en las burbujas de los mensajes del usuario. En el modo noche se estableció el matiz "Aqua" (`#00D4B3`) y en el modo claro el azul profundo corporativo (`#0A2540`), ajustando los contrastes tipográficos para legibilidad experta.

### Fixed

- **Copiar y Pegar Resuelto:** Reparado definitivamente el botón de copiado de cada mensaje; tanto para los creados por el usuario como los del asistente. Se añadió feedback visual en tiempo real ("¡Copiado!").
- **Eliminación del Borde Amarillo:** Subsanado un molesto anillo de enfoque amarillo (outline) nativo del navegador que se disparaba al teclear código y ensuciaba el minimalismo del chat.
- **Solución Definitiva de Layout Lateral:** Arreglado un _clipping_ agresivo que recortaba los paneles flotantes (menú de usuario) cuando se minimizaba la "sidebar", provocado por restricciones de desbordamiento CSS.
- **Resolución de App Rota (Blanco Total):** Salvado el colapso crítico de iniciación local que generaba el compilador de Vite a causa de referencias huérfanas al servicio aún no construido `workspace-sources-service` dentro del core del ChatUI.
- **Consistencia de Versionado:** Reparada la desincronización de la pantalla estática de inicio de sesión ("Bienvenido"), la cual exhibía una falsa v1.0 engañando al usuario, unificando toda la app con la v0.0.9 real.

## [0.0.8] - 2026-03-07

### Added

- **Soporte para Gemini 3.1 Pro:** Actualizados todos los servicios (Desktop Agent, Chat UI, Extensión) para utilizar el nuevo modelo `gemini-3.1-pro-preview` con mayor capacidad de razonamiento.
- **Upgrade Gemini Lite:** La extensión ahora utiliza `gemini-3.1-flash-lite-preview` para respuestas rápidas y eficientes.
- **Asistente de Portapapeles:** Mejora en el motor de IA del portapapeles utilizando ahora `gemini-3-flash-preview`.

### Changed

- **Nuevo Diseño Premium del Instalador:** Rediseño completo del asistente de instalación con un tema oscuro elegante (`#12151A`), corrección de bordes en el logo y enlaces directos al portal oficial.
- **Estética de Notas de Versión:** Nuevo sistema de diseño para las notas de actualización que ahora soportan formato HTML (negritas, listas, encabezados) con tipografía optimizada.

### Fixed

- Corregido error 404 al descargar actualizaciones: el nombre del instalador tenía un espacio (`SofLIA Hub-...`) que causaba un desajuste con la URL de descarga en GitHub Releases. Ahora se genera como `SofLIA-Hub-...` (con guión).
- Actualizado el pipeline de CI/CD para que los nombres de los artifacts coincidan con los nuevos nombres sin espacios.
- Corregido el renderizado de etiquetas HTML (`<h3>`, `<ul>`, `<strong>`) en el panel de actualizaciones que antes se mostraban como texto plano.

## [0.0.6] - 2026-03-07

### Added

- **Sistema de Memoria de Rutas:** SofLIA ahora conoce la ubicación real de tus archivos y carpetas. Un servicio en segundo plano escanea tu sistema de archivos (incluyendo OneDrive con nombres en español como Escritorio, Documentos y Descargas) y mantiene un mapa actualizado que el agente de WhatsApp usa para encontrar tus archivos sin equivocarse.
- Integración de 6 servicios que estaban desconectados: portapapeles inteligente, programador de tareas cron, monitor nativo de CPU/RAM, organizador de archivos, búsqueda semántica y cola de tareas con reintentos.
- Captura de pantalla multi-monitor: al pedir una captura por WhatsApp, ahora se envían todos los monitores conectados (antes solo capturaba uno).

### Changed

- El mapa de rutas se actualiza automáticamente cada 15 minutos y detecta cambios en tiempo real en Descargas, Escritorio y Documentos.
- AutoDev ahora verifica que los archivos nuevos estén importados por al menos otro archivo antes de aprobar un cambio (evita código huérfano).

### Fixed

- Corregido crash al iniciar la app causado por `__dirname is not defined` cuando Vite intentaba empaquetar módulos nativos (`node-cron`, `systeminformation`).
- El agente de WhatsApp ya no falla al buscar archivos en rutas de OneDrive con nombres en español.

## [0.0.5] - 2026-03-05

### Fixed

- Corregido el logo de SofLIA que no se mostraba correctamente en la aplicación instalada.
- Solucionado un problema que impedía iniciar sesión en la versión instalada al no detectar la configuración del servidor.
- Corregidas todas las imágenes y avatares que aparecían rotos dentro de la aplicación empaquetada.

## [0.0.4] - 2026-03-05

### Added

- Compatibilidad para poder instalar SofLIA Hub de manera nativa en computadoras Mac (Apple).
- Sincronización automática de tu foto de perfil, puesto y departamento desde tu cuenta corporativa.
- Nueva animación interactiva en el logotipo al momento de iniciar sesión.

### Changed

- **Nuevo diseño de instalación:** ¡Renovamos completamente la experiencia de instalación y desinstalación! Ahora cuenta con un diseño moderno, elegante y alineado a nuestra identidad corporativa.
- Mejoras visuales en las tarjetas de proyectos para que la información se perciba más organizada, simétrica y fácil de comprender en un solo vistazo.
- Interfaz más cómoda: Ajustamos generosamente los espacios entre los botones en los menús de configuración para facilitar su uso.
- Navegación más ágil: Simplificamos las animaciones de las pantallas emergentes para hacer el sistema más rápido y sin distracciones.

### Fixed

- Solucionamos un inconveniente que de manera esporádica impedía abrir los proyectos que habías creado.
- Arreglo visual en botones y opciones de los menús laterales que quedaban cortados en la pantalla y no se podían pulsar.

### Removed

- Retiramos algunas características irrelevantes en la vista de resúmenes para mantener tu espacio de trabajo más limpio, ordenado y veloz.

## [0.0.3] - 2026-03-05

### Added

- Build para macOS (DMG) en el pipeline de CI/CD
- Pipeline multi-plataforma: Windows y Mac compilan en paralelo

### Fixed

- Escape de comillas en workflow de GitHub Actions
- Variables TypeScript no declaradas (`isGroupPolicyDropdownOpen` en WhatsAppSetup)
- Variables no usadas en CalendarPanel y ProductivityDashboard

## [0.0.2] - 2026-03-05

### Added

- Sistema de auto-actualización con electron-updater y GitHub Releases
- Notificación reactiva in-app cuando hay una nueva versión disponible (estilo VS Code)
- Panel de "Actualización" en Configuración para buscar actualizaciones manualmente y ver novedades
- Barra de progreso de descarga en tiempo real
- GitHub Actions CI/CD — build y release automático al hacer push a main
- Herramientas de Google Workspace en el chat (Calendar, Gmail, Drive, Google Chat)

### Fixed

- Pipeline de persistencia del monitoreo de productividad (timestamps IPC, flush directo por snapshot)
- Contador de capturas ahora se actualiza en tiempo real
- Generador de resúmenes ahora recibe todos los snapshots de la sesión completa
- Retry automático para errores transitorios de red al guardar en Supabase

### Changed

- Buffer de flush reducido de 5 a 2 snapshots para persistencia más rápida
- Dashboard de productividad ahora refresca cada 15s durante monitoreo activo (antes 60s)

## [0.0.1] - 2026-02-26

### Added

- Chat con IA (Google Gemini) con soporte multimodal
- Integración WhatsApp vía Baileys (QR login, agente autónomo)
- Google Calendar, Gmail, Drive y Google Chat
- Sistema de monitoreo de productividad (capturas, timeline, resúmenes IA)
- Project Hub (IRIS) — proyectos, issues, sprints
- CRM-lite — empresas, contactos, oportunidades
- Motor de workflows BPM-lite con aprobaciones HITL
- AutoDev — sistema de auto-programación multi-agente
- Modo Flow (ventana flotante con Ctrl+M)
- Sistema de memoria persistente (SQLite)
- Notificaciones proactivas vía WhatsApp
- Desktop Agent para automatización de computadora
