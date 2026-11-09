## Context

Ver propuesta. El servicio Gmail comparte OAuth con CalendarService y sus interceptores ya bloquean sesiones obsoletas. El envío actual construye MIME manualmente y omite errores de adjuntos. Nodemailer 9.0.4 ya existe para SMTP, pero conserva avisos; la versión 10 exige Node >=20, compatible con CI 24 y Electron 44.

## Goals / Non-Goals

**Goals:** un único contrato de envío, preparación íntegra y limitada, confirmación nativa en gmail:send y resultado sin falso éxito. Probar compositor real y consumidor SMTP local al actualizar la dependencia.

**Non-Goals:** endurecer todos los canales Gmail en esta unidad, reemplazar proveedores o ejecutar mensajes reales. No aplicar SQL ni asumir permisos IRIS ausentes del repositorio.

## Decisions

- DTO compartido en `src/shared/gmail-delivery.ts` con schema estricto. La forma pública se conserva y añade cancelled/uncertain opcionales. Destinatarios aceptan dirección simple o un solo nombre con dirección; se separan explícitamente nombre/address y no se delega su interpretación ambigua al parser MIME.
- El adaptador del chat sólo convierte nombres snake_case y destinatarios separados por comas; usa el mismo schema y no convierte tipos erróneos ni recorta/filtra adjuntos. La revisión detectó que su slice(0, 10) preservaba el defecto antes de llegar al servicio y se retira.
- Actualizar Nodemailer exacto a 10.2.1 sin ejecutar scripts. Reutilizar MailComposer con acceso a URLs/archivos deshabilitado; pasar únicamente strings validados y buffers preparados. Evitar un serializador MIME propio para Unicode, nombres y líneas base64. Retirar @types/nodemailer si los tipos incluidos sustituyen el paquete sin consumidores pendientes.
- Lector de adjuntos separado: lstat/open/fstat, comparación de identidad/tamaño/mtime y lectura incremental de cuota + 1; captura de bytes una sola vez, nombres seguros y recursos cerrados en finally. Las cuotas son política del Hub, no una promesa de límites universales de Gmail.
- Promover la guarda de caller/confirmación de calendario a utilidad IPC compartida, conservando los textos y exports existentes de calendario. Cada familia mantiene su exclusión de diálogo; una respuesta tardía no libera ni reutiliza otra aprobación.
- El servicio captura owner/revisión/conexión antes de cualquier await; recibe guardas y callback de aprobación opcionales para la ruta IPC. Los consumidores runtime conservan su HITL previo y también la guarda de conexión del servicio. Se prepara MIME antes de confirmar y se transmite el mismo buffer; no se releen archivos después de la aprobación.
- Distinguir fallo previo al transporte de incertidumbre posterior. Gmail no ofrece aquí una clave de idempotencia verificable: sin reintentos automáticos. No afirmar rollback de correo ya aceptado.

## Risks / Trade-offs

- Memoria al materializar MIME → cuotas por adjunto/acumulado/final y lectura incremental; liberación tras resultado.
- TOCTOU de archivos → identidad del handle y metadata estable durante lectura; tras prepararlo se envía la copia confirmada. No se garantiza detectar mutación maliciosa que preserve toda la metadata.
- Cambio de cuenta mientras se prepara/confirma → guarda de sesión y caller antes/después de esperas, interceptores existentes y pruebas A/B/A.
- Compatibilidad mayor Nodemailer → revisar exports CJS/ESM, tipos y ganchos; probar SMTP y MIME reales locales además de mocks del producto.
- Otros canales Gmail siguen con deuda → documentar explícitamente alcance y siguiente unidad, sin declarar endurecimiento global del correo.

## Migration Plan

Sin migración de datos ni canales nuevos. Baseline, contratos negativos, archivos reales temporales, transporte SMTP local, gate y build aislado. Revertir sólo esta unidad si es necesario; conservar los bloques anteriores. La revisión independiente permanece pendiente antes de archivar.

Fuentes: [MailComposer](https://nodemailer.com/extras/mailcomposer), [adjuntos](https://nodemailer.com/message/attachments), [cambios de versión](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md). Ninguna prueba usa credenciales reales.
