## Why

Con tres pestañas del navegador integrado, Pulse Hub consume aproximadamente 1,5–1,9 GB de RAM y 15 % de CPU en el equipo reportado, valores cercanos a Chrome. La implementación actual mantiene timers y animaciones a ritmo completo en todas las pestañas y captura la pestaña activa de forma periódica incluso en reposo, por lo que se necesita una política de recursos medible y adaptativa.

## What Changes

- Aplicar throttling dinámico a pestañas ocultas y conservar sin throttling únicamente las superficies web visibles o controladas activamente.
- Sustituir el muestreo visual pasivo perpetuo por capturas acotadas disparadas por navegación/interacción y por observación explícita del agente.
- Suspender por LRU pestañas frías no protegidas después de un periodo de gracia, conservando su identidad y última URL para restauración.
- Proteger de suspensión pestañas visibles, ventanas separadas, reproducción de audio y tareas activas del agente.
- Incorporar un benchmark reproducible y diagnóstico agregado de CPU/memoria por tipo de proceso Electron para comparar antes/después.
- Registrar presupuestos, límites, riesgos de restauración y evidencia de verificación en la documentación canónica.

No objetivos: reemplazar Electron/Chromium, alterar permisos o sesiones, cerrar pestañas lógicas, degradar audio/video visible ni prometer una cifra universal independiente de los sitios y del equipo.

## Capabilities

### New Capabilities

- `runtime-resource-efficiency`: Política observable de CPU/memoria para pestañas web, percepción pasiva y procesos Electron, con protección de trabajo activo y restauración segura.

### Modified Capabilities

Ninguna. Los contratos de pestañas y observación todavía viven en el cambio no archivado `evolve-integrated-browser-workspace`; este cambio añade una capacidad independiente de eficiencia y documenta su interacción.

## Impact

Afecta principalmente `electron/integrated-browser/service.ts`, sus tipos y pruebas, parámetros de runtime y scripts de diagnóstico/benchmark. Puede usar `app.getAppMetrics()` y `webContents.setBackgroundThrottling()` ya disponibles en Electron; no agrega dependencias, tablas, migraciones, permisos, secretos ni canales IPC públicos.
