## Why

Electron 44.5.1 está dentro del rango afectado por el aviso oficial
GHSA-jr5w-w6x2-84p9 sobre certificados intermediarios comprometidos. La
verificación actual sólo exige estabilidad/coincidencia y corre al preparar
release: permitiría validar otra vez una versión estable afectada.

## What Changes

- Fijar Electron 44.9.3, estable de la misma rama mayor, y comprobar paquete y
ejecutable físicos tras instalar.
- Rechazar rangos conocidos del aviso con comparación semver mantenida, sin
permitir que una excepción temporal de beta suprima la política de seguridad.
- Incluir runtime:stable en verify:pr; mantener la verificación de release sin
ejecutarla dos veces.
- Regresiones de límites/metadata, auditorías comparables y smokes Electron
aislados de consumidores, con documentación y evidencia proporcional.

## Capabilities

### New Capabilities

- `verified-electron-runtime`: requisito verificable de runtime parcheado,
coincidencia entre fuentes/ejecutable y barrera previa de checkout.

### Modified Capabilities

Ninguna API de producto cambia.

## Impact

package/lock, checker y gate de calidad, tests existentes y documentación de
runtime/operación/seguridad. semver ya instalado pasa a dependencia dev explícita
para no implementar un comparador parcial. No cambia IPC, datos, permisos,
secretos, políticas TLS propias ni instalaciones desplegadas.
