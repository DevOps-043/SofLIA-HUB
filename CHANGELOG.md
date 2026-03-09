# Changelog

Todos los cambios notables de SofLIA Hub se documentan aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.1.0] - 2026-03-09

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
