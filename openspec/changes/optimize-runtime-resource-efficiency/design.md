## Context

La motivación está en `proposal.md`. Hoy cada `WebContentsView` nace con `backgroundThrottling: false`, el límite LRU sólo actúa al superar ocho vistas vivas y la captura visual pasiva se reprograma para siempre cada 10 segundos (30 segundos en multimedia). Electron expone control dinámico por `webContents.setBackgroundThrottling()` y métricas de procesos por `app.getAppMetrics()` sin dependencias nuevas.

La visibilidad no equivale siempre a pestaña activa: los modos dividido y superpuesto muestran dos vistas; una ventana separada puede permanecer visible aunque no sea la pestaña primaria; los paneles renderer ocultan brevemente una vista activa para poder superponer controles. La política debe calcular superficies realmente presentadas y no basarse sólo en `activeTabId`.

## Goals / Non-Goals

**Goals:**

- Hacer barato el estado oculto sin alterar la cadencia de una página visible.
- Reducir memoria con suspensión gradual, protegiendo trabajo web activo.
- Eliminar readbacks periódicos del compositor cuando la página está estable.
- Producir métricas comparables y redacted con costo cero cuando están apagadas.

**Non-Goals:**

- Preservar el heap/DOM exacto de una pestaña suspendida; la restauración recarga su URL.
- Gestionar prioridades del sistema operativo, flags experimentales de Chromium o DevTools Protocol.
- Implementar un panel de rendimiento público o un canal IPC nuevo.

## Decisions

### Throttling dinámico, no global

Las vistas se crean con throttling permitido. Después de cada cambio de layout, foco, visibilidad, ventana separada o control del agente, una única función reconcilia la prioridad: `setBackgroundThrottling(false)` sólo para vistas realmente presentadas y `true` para el resto. Ocultar brevemente la vista activa bajo un menú no cambia la prioridad si su ventana anfitriona sigue visible, evitando la reanudación lenta que motivó el valor global anterior.

Alternativa descartada: mantener `backgroundThrottling: false` para evitar cualquier pausa. Consume CPU de todas las páginas ocultas. También se descarta aplicar flags globales de Chromium porque amplían el radio de impacto y son difíciles de verificar por pestaña.

### Un fondo caliente y suspensión diferida

En modo simple se conserva la pestaña visible y una pestaña oculta reciente como respaldo caliente. Las demás vistas ocultas pueden suspenderse después de 90 segundos; cuando la ventana anfitriona está oculta/minimizada el periodo se reduce a 30 segundos. En composiciones con dos vistas se protegen ambas, además del mismo respaldo reciente. La reconciliación usa un único timer al próximo vencimiento, no polling.

No se suspende una vista que carga, es audible, está siendo capturada, tiene DevTools, vive en una ventana separada visible o participa en Computer Use. Activar una pestaña actualiza su recencia antes de aplicar el presupuesto. El límite duro de ocho vistas se conserva como defensa adicional.

Alternativa descartada: bajar el límite duro a dos y descartar inmediatamente. Reduce memoria antes, pero convierte el cambio entre tres pestañas en recargas continuas y degrada la fluidez.

### Observación pasiva dirigida por eventos

La captura inicial y las capturas diferidas por carga/navegación/entrada se mantienen. Tras completar una captura pasiva, el timer no se vuelve a programar por sí solo; un nuevo evento relevante o una solicitud explícita vuelve a activarlo. Las herramientas del agente ya solicitan `getObservation(true)`, por lo que su inspección fresca no depende del timer.

Alternativa descartada: desactivar por defecto toda percepción. Ahorraría más, pero rompería el contrato actual y obligaría al usuario a habilitarla antes de cada tarea.

### Diagnóstico opt-in en main

Un monitor pequeño agrega `app.getAppMetrics()` por `type` y registra cada 30 segundos sólo al arrancar con `--resource-diagnostics`. El agregado usa `memory.workingSetSize` en KiB y `cpu.percentCPUUsage`; no incluye nombres de sitios, URLs, contenido o argumentos. Expone funciones puras para pruebas y un `dispose()` idempotente.

Alternativa descartada: un panel renderer con polling IPC. Añadiría trabajo periódico y un contrato de cuatro capas que no es necesario para una medición de ingeniería.

## Risks / Trade-offs

- [Una pestaña suspendida pierde estado DOM no persistido] → Periodo de gracia, un respaldo caliente, protecciones de medios/captura/agente y estado `isSuspended` visible ya existente.
- [Una web mantiene audio inaudible o trabajo crítico no detectable] → `isCurrentlyAudible`, `isBeingCaptured`, carga/espera de respuesta y ventana visible cubren señales oficiales; el límite se documenta y la política se concentra en una función reversible.
- [Cambios frecuentes crean varios timers] → Un único timer de reconciliación se cancela y reemplaza; el cierre del servicio lo libera.
- [Las métricas varían por sitio, caché y máquina] → Escenario controlado, múltiples muestras, mediana/promedio y reporte separado por host; no se extrapola como garantía universal.
- [El beta/runtime de Electron cambia una API] → Se usa API tipada ya presente en la versión fijada y se cubre con harness de mocks.

## Migration Plan

1. Añadir pruebas de prioridad, protecciones, suspensión/restauración y scheduler de percepción.
2. Implementar la reconciliación detrás de constantes centralizadas y conservar el límite duro LRU como fallback.
3. Añadir el diagnóstico opt-in y ejecutar una línea base antes/después con el mismo fixture cuando el host lo permita.
4. Actualizar parámetros y evidencia; ejecutar gates proporcionales y revisión adversarial.

Rollback: restaurar `backgroundThrottling: false`, desactivar el timer de suspensión y volver a reprogramar la captura pasiva. No hay migraciones, datos remotos ni estado irreversible que deshacer.
