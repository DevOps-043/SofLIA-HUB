## Why

Gmail omite adjuntos que no puede leer y puede informar éxito sobre un correo incompleto. El canal de envío no valida emisor, sesión o confirmación en main, y el ensamblaje MIME manual interpola cabeceras y nombres.

## What Changes

- Validar el envío en una frontera compartida, con destinatarios inequívocos y cuotas explícitas.
- Preparar todos los adjuntos con lectura acotada antes del transporte; fallar de forma completa ante errores.
- Reutilizar el compositor MIME de Nodemailer tras actualizarlo a 10.2.1 corregido, sin nuevas dependencias directas, verificando el consumidor SMTP existente.
- Exigir sesión, ventana/marco registrados, conexión del actor y confirmación nativa vigente en gmail:send. Mantener guardas durante preparación y antes de transporte.
- Devolver errores seguros y marcar resultados inciertos sin reintento automático.

## Capabilities

### New Capabilities
- `gmail-delivery`: contrato verificable de envío íntegro y autorizado por IPC, preparación acotada y resultado explícito.

### Modified Capabilities
Ninguna. Los otros canales Gmail y los contratos de IRIS quedan fuera del alcance.

## Impact

Servicio Gmail, compositor/adjuntos, guardas IPC compartidas con calendario, preload/wrapper/tipos de envío y documentación. Actualización mayor de Nodemailer compatible con Node 24/Electron actual, CJS/ESM revisados y sin ganchos de instalación. No cambia allowlist, datos persistidos o permisos remotos; no se envía correo real.
