# Creación de proyectos dentro de la aplicación

Estado: corrección local verificada; compuerta general con bloqueo TypeScript preexistente. Fecha: 2026-10-24. Evidencia vigente en reports/provider-verification.md; reports/verification.md es la primera iteración histórica.

- Objetivo: sustituir el formulario lateral por un diálogo dentro de la ventana principal.
- Actor: usuario autenticado en la organización activa.
- Alcance corregido por el usuario: nombre, organización interna sin bloque visible, selector nativo Windows/macOS/Linux, carpeta principal/adicional y Google Drive/OneDrive de las cuentas vinculadas; lista aislada por organización.
- No objetivos: sincronización offline, importar árboles completos ni modificar permisos de compartición o carpetas heredadas.
- Contratos: resolución exacta de organización a workspace autorizado, selector de directorios dentro del diálogo, creación configurada y lectura privada de ubicación; cuatro capas IPC.
- Decisión: las carpetas adicionales se vinculan, no se copian ni se publican. Local crea una subcarpeta exclusiva; Google Drive y OneDrive crean la carpeta y reciben archivos mediante sus APIs. El selector nativo local sustituye el navegador React previo.
- HITL: Crear proyecto confirma nombre y ubicación. La organización sigue asignada internamente. El usuario autorizó el selector nativo del sistema y, al pulsar Autorizar OneDrive, la autorización incremental de archivos de su cuenta vinculada.
- Criterios: sin selector workspace; no elegir el primer workspace ni inferir por nombre; descartar respuestas al cambiar organización; sin sobrescritura de carpetas; resultado incierto no reenvía creación; preferencias privadas por usuario/proyecto; cancelar antes de crear no escribe.
- Límites actualizados: el negocio se consulta y escribe directamente en IRIS desde main, usando la sesión verificada de Learning y su organización activa; no pasa por la API web. Los archivos siguen en equipo/Drive/OneDrive. No se acredita una remediación global de RLS ni la creación durable de nuevos bindings de chat. Los espejos ausentes de identidad, espacio y membresía se sincronizan desde la organización comprobada; espacios o membresías deshabilitados no se reactivan como fallback.
