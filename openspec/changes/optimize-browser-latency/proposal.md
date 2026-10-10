## Why

El navegador realiza trabajo repetido al escribir y redimensionar, y los acuses
de apertura/navegación esperan recursos lentos. La sonda nativa local confirma
887–1039 ms de acuse con un recurso de 750 ms, 49 lecturas de selección por cinco
teclas ordinarias y 100 publicaciones por 100 viewports idénticos.

## What Changes

- Acusar las operaciones humanas tras validación e inicio de carga, conservando
  espera completa para agentes y consumidores internos que la necesitan.
- Evitar publicaciones/layout/IPC redundantes de geometría, agrupar ResizeObserver
  por cuadro y conservar la restauración tras ocultar overlays.
- Consultar selección ante cambios reales y gestos de selección, conservar
  iframes dinámicos y rechazar resultados de documentos/pestañas obsoletos.
- Medir antes/después con el mismo servicio compilado y servidor local aislado.
- Retirar vistas nativas huérfanas tras recargar la interfaz y conservar las
  sugerencias de dirección únicamente para el texto vigente.
- Agrupar cierres de pestañas, restaurar pantalla completa y conservar selección
  válida aun cuando falle la limpieza nativa o la creación del reemplazo.
- Corregir inventario documental de pruebas con sincronización explícita desde
  Git y ejecutar la compuerta general completa sin relajar sus validaciones.

No objetivos: cambiar red remota, caché HTTP, permisos, reputación, certificados,
reuniones de Google, motor Electron ni parámetros experimentales de Chromium.

## Capabilities

### New Capabilities

- `browser-interaction-latency`: contratos de acuse, geometría y sondeo acotados.

### Modified Capabilities

Ninguna. Las capacidades previas mantienen sus guardas y datos.

## Impact

Servicio y handlers existentes, panel React, pruebas y sonda nativa. No se crean
canales IPC, dependencias, esquemas ni migraciones. Documentación y parámetros
registran presupuestos, evidencia y límites de medición.
