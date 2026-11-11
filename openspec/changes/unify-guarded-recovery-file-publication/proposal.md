## Why

Tres motores repiten publicación síncrona con temporal/fsync/rename-link. Sus
finally pueden sustituir un fallo de escritura/publicación por el de close o
unlink, perdiendo la causa y el estado que soporte necesita para recuperar.

## What Changes

- Reproducir el fallo primario oculto con archivos temporales propios.
- Compartir una primitiva de publicación síncrona integrada, con propiedad de
temporal, cierre antes de publicar y guardas antes del efecto público.
- Conservar el primer error si cierre/limpieza también fallan y declarar el
residuo con mensajes estáticos. Un error exclusivo de cierre impide publicar.
- Verificar consumidores/rollback sync y ejecución Electron; documentar límites.

No agrega dependencias, permisos, canales, formatos, reintentos ni operaciones
remotas. Borrados explícitos y sus errores siguen siendo responsabilidad del motor.

## Capabilities

### New Capabilities
- `browser-recovery-file-publication`: ciclo de publicación y precedencia de errores.

### Modified Capabilities

Ninguna especificación vigente cambia su contrato público.

## Impact

semantic-memory-recovery, sqlite-store-recovery y sync-state-recovery pasan a
consumir una primitiva privada. Servicios, confirmaciones, main/preload/renderer,
cifrado, revisiones y marcador sync conservan sus responsabilidades y formatos.
