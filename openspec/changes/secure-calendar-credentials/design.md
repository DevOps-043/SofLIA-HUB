## Context

Ver propuesta y contexto. La persistencia actual es global y loadConnections fuerza isActive.
setUserId sólo se usa en pruebas; init restaura antes de asociar una identidad.

## Goals / Non-Goals

Proteger credenciales y resultados por identidad manteniendo la integración de Workspace.
No certificar aislamiento entre procesos bajo el mismo usuario del SO ni cancelar efectos remotos ya enviados.

## Decisions

- Usar safeStorage asíncrono disponible en Electron 44, rechazando backend Linux basic_text/unknown. Sin cifrado, no restaurar ni completar nuevas conexiones persistentes.
- Un archivo cifrado por SHA-256 del userId; propietario/versionado también dentro del contenido cifrado. Validación cerrada, límites de tamaño y sólo dos proveedores. No poner emails/IDs/tokens en rutas o logs.
- Serializar acceso al almacén; guardar a temporal exclusivo, flush y renombrar. Guardas de identidad antes de cifrar y de publicar. Los errores conservan la versión previa y no dejan temporales planos.
- Sellar el JSON heredado completo en su misma ruta mediante reemplazo cifrado atómico. Se conserva el contenido, incluidos registros sin dueño, sin crear otra copia plana. Sólo importar registros cuyo userId coincida exactamente. Un archivo nuevo existente (incluido vacío o ilegible) impide volver a importar del legado.
- Cambios de sesión limpian inmediatamente memoria, polling y contexto de trabajo. Revisiones invalidan A/B/A; guardas de conexión invalidan reemplazos. Ningún await tardío puede publicar eventos o actualizar tokens del contexto anterior.
- Conservar load/save como métodos del servicio, ahora asíncronos, y propagar su resultado antes de anunciar conexión/desconexión. El cliente OAuth común conserva su API.
- Proteger el transporte OAuth compartido antes de cada solicitud y al recibir respuestas; esto incluye clientes retenidos por Gmail/Drive/Chat. Mantener expiración y refresh token rotado.
- Al tipar la consulta Microsoft se valida su DTO externo y se normalizan fechas sin zona como UTC (valor por defecto del proveedor); fechas con offset se conservan. No se agrega preferencia de otra zona.

## Risks / Trade-offs

- Migrar no atribuye conexiones huérfanas: requieren OAuth de nuevo. El archivo cifrado heredado conserva recuperación sin resucitar conexiones borradas.
- Fallo de disco/cifrado: negar persistencia y mantener archivo anterior. No afirmar durabilidad total frente a corte eléctrico en todas las plataformas.
- La custodia del SO no protege contra procesos con los mismos privilegios; pruebas locales usan cifrado y secretos ficticios, con smoke nativo aislado si está disponible.
- No revocar una llamada que ya llegó a Google/Microsoft; bloquear las que aún no se enviaron y sus resultados tardíos.

## Migration Plan

Se ejecuta sólo en runtime autenticado, con guardas vigentes, sin borrar registros. No ejecutar sobre perfiles reales en esta tarea.
Rollback de código mantiene archivos cifrados; una versión vieja no podrá leerlos y deberá reconectar. Nunca convertirlos a texto plano para facilitar downgrade.
