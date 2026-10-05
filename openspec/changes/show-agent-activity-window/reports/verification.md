# Verificación del monitor de equipos

Fecha: 2026-09-24. Rama: `codex/agent-activity-window`.

## Evidencia

- `npm run verify:pr`: aprobado; 3537 pruebas aprobadas y una omitida,
  338 archivos aprobados y uno omitido. Incluye tipos, lint incremental,
  OpenSpec, documentación, adaptadores y arnés.
- `npm run build:app`: aprobado. Advertencias existentes de tamaño de chunks,
  imports dinámicos y configuración de Vite; sin errores de compilación.
- Revisión independiente: nueve pruebas dirigidas aprobadas en cinco archivos.
- `node scripts/quality/smoke-agent-activity.mjs`: aprobado con Electron real,
  renderer y preload compilados. Metadatos sintéticos de una presentación de
  WhatsApp. Verificó API restringida, ocultar, reabrir, minimizar/restaurar y
  cierre sin destruir; captura inspeccionada sin recortes de texto o controles.

## Revisión adversarial

Se intentó refutar el aislamiento de frame/usuario, el rechazo de esquemas con
texto privado, el límite de doce equipos, secuencias atrasadas, limpieza de
sesión, fallos de observadores y cierre de la vista sin cancelar ejecución.

El revisor encontró dos P2 en Meeting Ops: equipos desaparecidos del snapshot
quedaban activos y errores de la vista podían propagarse al arnés. Ambos se
corrigieron, se añadieron regresiones y el revisor confirmó el cierre sin
bloqueantes adicionales.

## Límites

No se realizaron inferencias de pago ni envíos externos. El smoke no acredita
el comportamiento de foco frente a otras aplicaciones ni todos los monitores,
escalas de pantalla o sistemas operativos. La actividad renderer procede del
chat principal; la Orbe no publica en este monitor. Los equipos son efímeros;
cerrar sesión elimina el historial visible. La UI indica aportes listos, no
conclusión de toda la tarea principal.

## Reversión

Revertir el commit del cambio retira ventana, eventos y canales nuevos sin
migración de datos ni pérdida de resultados persistentes de Meeting Ops.
