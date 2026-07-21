# Definicion y alcance del producto

Estado: vigente. Actualizado: 2026-07-21.

SofLIA Hub es una aplicacion de escritorio Electron orientada a equipos de habla
espanola. Unifica conversacion asistida por IA, gestion de proyectos y fuentes,
reuniones, decisiones operativas, productividad, canales WhatsApp/Telegram,
Google Workspace, automatizacion de escritorio, memoria y herramientas dinamicas.
No es una aplicacion web autonoma: el renderer React depende de capacidades del
proceso main expuestas por preload y de servicios remotos configurados.

<!-- evidence: package.json -->
<!-- evidence: src/app/AppWorkspace.tsx -->
<!-- evidence: electron/main/service-factory.ts -->

## Problema que resuelve

El Hub reduce el cambio de contexto entre conversaciones, archivos, calendario,
correo, proyectos, minutas y acciones. La interfaz local centraliza supervision y
configuracion; los canales permiten operar fuera de la ventana; los agentes
ejecutan herramientas bajo permisos y confirmaciones; memoria y fuentes conservan
contexto entre sesiones.

Esta formulacion se deduce de las capacidades conectadas. El repositorio no
contiene un estudio comercial versionado que confirme mercado, TAM, pricing o
metricas de negocio; esos temas no se presentan como hechos.

## Capacidades implementadas

| Dominio | Comportamiento observable | Entrada principal | Evidencia |
|---|---|---|---|
| Identidad y organizaciones | Inicio de sesion SOFIA, seleccion de organizacion y equipos | Pantalla de autenticacion y menu de usuario | `src/contexts/auth/`, `src/lib/sofia-client.ts` |
| Chat | Conversaciones, mensajes, carpetas, adjuntos, fuentes y uso de herramientas | Vista `chat` | `src/app/AppChatView.tsx`, `src/services/chat/` |
| Project Hub | Chat y fuentes agrupados por carpeta/proyecto; navegacion IRIS | Vista `project` y sidebar | `src/app/AppProjectView.tsx`, `src/components/project-hub/`, `src/services/iris-data/` |
| Productividad | Sesiones, actividad, aplicaciones, OCR opcional y resumen | Vista `productivity` | `src/components/ProductivityDashboard.tsx`, `electron/monitoring/` |
| Reuniones | Ingesta manual/Drive/live, artefactos, aprobacion y sincronizacion | Vista `meetings` | `src/components/meetings/`, `electron/meetings/` |
| SDO | Fuentes, evidencia, claims, decisiones, acciones, aprobaciones y auditoria | Vista `sdo` | `src/components/sdo/`, `electron/sdo/` |
| Canales | WhatsApp y Telegram personales/organizacionales, historial y programacion | Ajustes y servicios main | `electron/communication-hub/`, `electron/whatsapp/`, `electron/telegram/` |
| Workspace | Calendar, Gmail, Drive y Google Chat con autenticacion compartida | Chat, automatizaciones y ajustes | `electron/calendar/`, `electron/gmail/`, `electron/drive/`, `electron/gchat/` |
| Automatizacion | Plantillas, workflows, escritorio, navegador, nodos remotos y procesos de fondo | Herramientas, ajustes y agentes | `electron/workspace-automation/`, `electron/desktop-agent/`, `electron/remote-node/` |
| Memoria | Mensajes SQLite, conocimiento Markdown, indice FTS, hechos y skills aprendidas por owner | Chat, WhatsApp, escritorio | `electron/memory/`, `electron/knowledge/`, `electron/semantic-indexer/` |
| Voz y orbe | Dictado, wake word local, TTS y ventana flotante | Ventana `orb` y ajustes de voz | `electron/python-runtime-service.ts`, `src/components/orb/`, `electron/main/orb-window-controller.ts` |
| Actualizacion | Consulta, descarga, progreso e instalacion de releases | Ajustes y notificacion global | `electron/updater/`, `src/components/update-panel/` |

## Alcance de esta version documentada

- Version de aplicacion: `0.8.0`, tomada de `package.json`.
- Entrada desktop: `electron/main.ts`; entrada renderer: `src/main.tsx`.
- Plataformas empaquetadas: Windows x64/NSIS, macOS DMG y Linux x64
  AppImage/DEB, segun `electron-builder.json5`.
- Persistencia remota: tres proyectos Supabase separados por dominio.
- Persistencia local: SQLite y archivos JSON/Markdown bajo `app.getPath('userData')`.

## Fuera de alcance o no demostrado

- No hay backend HTTP propio desplegado en este repositorio; las APIs consumidas
  son Supabase, proveedores de IA, Google, Microsoft, Gamma y canales.
- `docs/contracts/openapi.json` describe un contrato auxiliar, no reemplaza IPC.
- Un snapshot SQL no demuestra que una tabla exista o tenga el mismo estado en
  produccion; las migraciones y la verificacion remota siguen siendo necesarias.
- Que un componente exista no prueba que sea accesible para todo rol; las
  condiciones de renderer y politicas main prevalecen.

## Criterio de producto terminado

Una capacidad solo se considera implementada cuando existe ruta de entrada,
contrato, servicio, persistencia si aplica, manejo de error y evidencia de prueba.
Los planes en `docs/plans/` y cambios OpenSpec sin archivar no se presentan como
funcionalidad productiva por si solos.
