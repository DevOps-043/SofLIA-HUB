# Changelog

Todos los cambios notables de SofLIA Hub se documentan aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
