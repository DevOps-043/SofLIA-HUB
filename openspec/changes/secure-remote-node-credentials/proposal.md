## Why

El servicio carga y guarda tokens en un JSON global, reemplaza fallos de lectura con defaults y mantiene estado/host al cambiar sesión. Una cuenta posterior puede recibir credenciales previas y un fallo de disco puede publicar una mutación no persistida.

## What Changes

- Cifrar perfiles por propietario exacto con el llavero del SO y publicación atómica, sin fallback plano.
- Conservar todo el legado en archivo cifrado; restaurar sólo registros con propietario coincidente y comunicar el re-emparejamiento pendiente.
- Derivar identidad en todas las operaciones, serializar mutaciones y publicar sólo tras guardar; cancelar estado/transporte/host en logout o A/B/A.
- **BREAKING de seguridad:** host nuevo apagado y operaciones sin sesión denegadas; no heredar credenciales huérfanas de otra cuenta.
- Acotar/revalidar cuerpos entrantes y sus efectos bajo el contexto del host; mantener el recorrido modular y probar migración/fallos/carreras con datos ficticios.

## Capabilities

### New Capabilities

- `remote-node-credential-custody`: perfiles cifrados por usuario, migración recuperable y ciclo de vida de nodos ligado a sesión.

### Modified Capabilities

Ninguna.

## Impact

Almacén/sesión/servicio de nodos, cliente y host HTTP, handlers, cierre de aplicación, contratos/status y aviso del panel, pruebas/documentación. Sin canales ni dependencias nuevas, SQL o despliegue. Se conservan guardas HITL del lote 39; no se acredita RLS ni aislamiento organizacional remoto.
