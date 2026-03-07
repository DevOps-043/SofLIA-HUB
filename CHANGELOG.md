# Changelog

Todos los cambios notables de SofLIA Hub se documentan aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.0.7] - 2026-03-07

### Fixed

- Corregido error 404 al descargar actualizaciones: el nombre del instalador tenía un espacio (`SofLIA Hub-...`) que causaba un desajuste con la URL de descarga en GitHub Releases. Ahora se genera como `SofLIA-Hub-...` (con guión).
- Actualizado el pipeline de CI/CD para que los nombres de los artifacts coincidan con los nuevos nombres sin espacios.

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
