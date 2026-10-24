# Contexto del cambio

Estado: propuesta para revisión. Fecha: 2026-10-23. No implementado.

Actualización posterior: implementación del panel autorizada por el usuario,
con tipografía e iconografía del Hub y botones más redondeados. Sólo el bloque
de panel se entrega; los contratos portables, proveedores y migraciones no se
declaran completados. Ver reports/panel-implementation.md.

- Objetivo: proyectos portables con carpeta física elegida, registro en base de datos e importación/exportación; colaboración completa sobre proyecto, tareas y archivos.
- Usuario o actor: propietario, administrador, colaborador, lector y el mismo usuario en varios dispositivos.
- Alcance confirmado por el usuario: carpetas sincronizadas y conexiones directas a OneDrive/Google Drive; los colaboradores comparten también archivos.
- Ampliación confirmada: abrir el proyecto sustituye el contenido central por un apartado de proyecto, distinto del chat, dentro de la interfaz existente. Sin pestañas ni ventanas nuevas. Incluye información general, tareas, archivos, páginas web, chats vinculados, hitos, equipos asignados, métricas y ciclos cuando existan.
- Decisión de diseño propuesta: entrada global Proyectos y menú vertical contextual, resumen como inicio, detalles en la misma superficie y regreso con contexto conservado. El mockup usa únicamente datos de ejemplo.
- Revisión confirmada del lateral: conservar el panel central aprobado y sustituir el menú pegado al borde por la envolvente flotante/redondeada de Soflia. Incluir icono del navegador, Nuevo chat, búsqueda y chats del proyecto; todos los chats creados desde ese contexto permanecen asociados al proyecto.
- No objetivos: modificar datos actuales, fusionar ramas durante esta planificación, ejecutar migraciones, enviar invitaciones reales, construir otro cliente general de sincronización o coeditar documentos binarios en tiempo real.
- Restricciones: español; identidad independiente de rutas; main/handler/preload/wrapper; permisos del servidor; sin secretos ni rutas absolutas en manifiestos portables; trabajo ajeno intacto.
- Contratos afectados: creación/membresía actual y nuevos contratos de aprovisionamiento, ubicaciones, revisiones, exportación/importación y recuperación. No son API desplegada comprobada.
- Riesgo y HITL: publicar/copiar archivos o conceder acceso requiere vista previa y aprobación. Seleccionar una raíz no autoriza leer todo el escritorio ni exportar secretos. Los estados parciales deben ser observables.
- Criterios verificables: abrir el mismo proyecto desde dos rutas; no duplicar al reintentar; colaboración sin acceso al disco ajeno; restaurar sin sobrescribir; no conceder owner desde un paquete; conservar versiones en conflicto; recuperar tras cerrar la aplicación.
- Criterios adicionales: abrir desde la lista sustituye el chat por el resumen; navegar sin pestañas/ventanas; abrir chat o recurso y volver sin perder selección; no revelar un chat privado al asociarlo; diferenciar cero/vacío/error/no autorizado; métricas con fórmula, periodo y actualización verificables.
- Incertidumbres técnicas: permisos/RLS efectivos actuales, scopes/pickers por cuenta, semántica de versiones de proveedor y límites de carga. Se resuelven con pruebas; disponer de una clave API no demuestra autorización.

## Evidencia del punto de partida

- La rama de retirada `codex/remove-project-hub-integration` conserva el commit `a7d705c`, separado del checkout principal observado.
- El checkout observado está en `codex/reduce-technical-debt`, con cambios ajenos pendientes de custodia/IPC/subida/descarga y otros dominios. No se modifican al redactar el plan.
- [Contrato actual](../../../src/shared/project-hub.ts): proyectos, tareas, miembros y evidencia; sin ubicación portable en creación.
- [Tipos actuales](../../../electron/project-hub/types.ts): identidad proyecto/workspace, sin vínculo de carpeta por dispositivo.
- [Carpetas Lia](../../../src/services/folder/types.ts): agrupación de conversaciones; no son ubicaciones físicas.
- [Reporte de permisos del 22 de octubre](../../../docs/reports/iris-access-2026-10-22.md): metadatos históricos con remediación no aplicada según el reporte. No sustituye una inspección actual o pruebas de aislamiento.
- Servidor revisado sólo por archivos locales en el repositorio hermano Project-Hub: `docs/openapi/project-hub-v1.yaml`, `apps/web/src/lib/api-v1/schemas.ts`, `auth.ts` y rutas de proyectos/miembros. La creación hace escrituras separadas y encola `project.chat_binding.requested`; añadir miembros exige pertenencia activa al workspace. No se observó despliegue real.
- El conector Microsoft existente solicita permisos de calendario, no acredita OneDrive. Los scopes Google actuales no equivalen a autorización acotada de esta capacidad.

Durante la investigación inicial no había herramienta conectada de consulta SQL IRIS. Esta revisión de interfaz no realiza consultas remotas ni acredita el despliegue actual. No se leyeron claves ni archivos .env ni se hicieron llamadas de negocio con credenciales.

La UI local observada tiene un UnifiedProjectHub con navegación por tabs y un manejador heredado que envía un resumen al chat. Son evidencia de comportamiento a reemplazar en el flujo nuevo, no el diseño aceptado. Los contratos locales revisados incluyen tareas/miembros/evidencia/analítica y un equipo principal; no certifican hitos, ciclos o múltiples equipos asignados. Estas capacidades requieren inventario y contrato antes de implementarse.

Fuentes visuales revisadas para el lateral: docs/standards/design-system.md, docs/ux/design-system.md, docs/architecture/frontend.md, Sidebar, SidebarHeader, SidebarTopActions, SidebarNavTools y BrowserWorkspaceLayout; además ProductivityDashboard, MeetingOpsPanel y ArtifactViewerPanel para coherencia de superficies. La envolvente vertical real tiene padding exterior de 10 px, radio rounded-2xl, blanco al 80 %, borde y sombra suaves, backdrop blur y ancho por defecto 276 px con colapso. El navegador nativo exige reservar su viewport: elevar z-index del menú no basta. Estos son patrones observados, no evidencia de que la nueva experiencia ya exista.
