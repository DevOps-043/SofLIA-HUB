## Why

MSAL 5.5.0 resuelto está afectado por el aviso de validación de origen
GHSA-xcx6-jx8p-x3h5. Además el flujo Microsoft construye un cliente confidencial
sin credencial y falla antes de abrir OAuth. El receptor compartido con Google
acepta cualquier petición con code, no comprueba state y puede abrir ventana
antes de que el puerto esté listo, con errores/timers sin cerrar correctamente.

## What Changes

- Actualizar MSAL a 7.1.1 y usar cliente público para la app de escritorio,
manteniendo autoridad, scopes y redirect registrados.
- Vincular cada intento Google/Microsoft con state y PKCE S256; nonce Microsoft
validado por SDK durante intercambio OIDC. Sin códigos URL ni payloads libres.
- Receptor loopback limitado y validado, limpieza física y errores controlados;
no aceptar callback inválido o contexto revocado como conexión.
- Abrir autorización sólo en navegador del sistema, con destino permitido y
ventana local de estado/cancelación, sin credenciales del proveedor embebidas.
- Pruebas de fronteras/SDK/carreras, documentación y auditoría comparables.

## Capabilities

### New Capabilities

- `bound-calendar-oauth-attempt`: autorización de calendario ligada al intento,
sesión vigente, origen y prueba criptográfica, con ciclo de vida recuperable.

### Modified Capabilities

Ninguna interfaz IPC pública cambia.

## Impact

Dependencia/lock, módulos OAuth main de calendario y pruebas. Se mantienen
handlers/preload/wrapper, DTO, custodia cifrada y consumidores existentes. No
añade scopes, secretos, tablas o permisos runtime. No prueba cuentas reales ni
resuelve renovación Microsoft o despliegue de claves Google en servidor.
