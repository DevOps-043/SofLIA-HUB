## Why

verify:pr aprueba sin ejecutar contratos Python de recursos, dependencias ni
guardas del builder. Las pruebas manuales de formatos con locks exactos tampoco
tienen ejecución por plataforma configurada en CI, dejando posibles regresiones
fuera de la compuerta ordinaria.

## What Changes

- Comando de desarrollo ejecuta el runner stdlib con Python 3.12.x, sin descargar
dependencias ni aceptar omisión por intérprete ausente/incompatible.
- verify:pr incluye esa etapa; CI y verificación previa de release configuran
Python 3.12.11 explícitamente.
- Workflow de formatos instala bootstrap/lector con hashes y sólo wheels en
cuatro targets. Sin permisos de publicación, secretos o modelo/audio.
  CI y builds de release dependen de esa verificación del mismo SHA.
- Casos negativos, documentación y evidencia local; remoto sigue sin ejecutarse.

## Capabilities

### New Capabilities

Ninguna capacidad de producto. Cambio de tooling con skip_specs: true.

### Modified Capabilities

Ninguna. Se mantienen contratos de lectura, transporte, IPC y permisos.

## Impact

package.json, scripts/quality, CI y job verify de release, nuevo workflow de
pruebas Python y documentación de desarrollo/calidad. No cambia el runtime,
pins, persistencia o empaquetado. Se conserva pendiente el candidato macOS Intel.
