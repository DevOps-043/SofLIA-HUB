# Recuperación de sesiones y regresión del lifecycle

Estado: continuación verificada de forma focalizada; no es candidato a release.
Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Continuación del [reporte anterior](verification-2026-09-04.md), preservado como
evidencia de esa ejecución. Checkout original de organizaciones/WhatsApp intacto.

## Alcance implementado

- Sesión v2 con primaria/secundaria, modo dividido/superpuesto y hasta cuatro
  ventanas separadas; lectura v1 con migración idempotente en memoria.
- Recuperación del respaldo si falta el principal o está corrupto. Reemplazo
  mediante temporal exclusivo con sync; el principal sigue presente mientras
  se prepara el respaldo. Un error de E/S o versión futura no mueve el original.
- Lectura acotada, esquema proyectado, exclusión de campos extra, referencias y
  IDs validados. Lecturas/guardados/descartes serializados por destino capturado.
- Descarte con lápida vacía antes de retirar el respaldo. Si falla, la UI no
  simula éxito ni pierde el aviso de restauración durante la operación.
- Restauración perezosa: 500 pestañas lógicas no causan 500 navegaciones. Se
  mantienen grupos/fijación/silencio y el presupuesto de ocho vistas vivas.
- Sesión pendiente no sobrescrita al cerrar sin decisión. Cambio de cuenta
  captura la saliente antes del desmontaje, bloquea aperturas durante E/S y
  descarta respuestas tardías de otro perfil o ventana.
- Restaurar libera pantalla completa y ventanas anteriores. La selección
  automática para dividir no elige una pestaña en ventana separada.

## Evidencia

Suite dirigida de esta continuación: 3 archivos / 93 pruebas
aprobadas después de las correcciones de concurrencia y pantalla completa.
La verificación general de PR vuelve a detenerse en `skills:seed:check` por la
divergencia del catálogo Lia, sin cambios en los archivos implicados en este
turno. No se regeneró SQL ni se ejecutó una migración remota.

Comando final del navegador:

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test
```

Resultado: **42 archivos / 421 pruebas aprobadas**, 17,48 segundos; 31 pruebas
más que las 390 registradas al cierre de la continuación anterior.

| Compuerta | Resultado final |
|---|---|
| `npm run typecheck` | Aprobada, renderer y main |
| `npm run lint:changed` | 65 archivos revisados, sin deuda nueva |
| `npm run openspec:validate` | 26 cambios aprobados, modo estricto |
| `npm run harness:validate` dentro de PR | 25 rutas y 9 skills canónicas válidas |
| `npm run docs:system:check` dentro de PR | 28 documentos, 150 IDs, 404 canales, 411 archivos de prueba |
| `npm run docs:check` dentro de PR | 253 Markdown activos con enlaces válidos |
| `npm run verify:pr` | No aprobada: se detiene en `skills:seed:check` |
| `git diff --check` | Sin errores de whitespace |

`git diff HEAD --` sobre el catálogo SQL, registro TypeScript y generador de
semillas no devuelve cambios. No se ejecutó otra vez la suite completa ni
`verify:release`; los fallos fuera del diff y la ejecución incompleta del turno
anterior siguen documentados, no se presentan como resueltos.

## Revisión adversarial

| Hipótesis | Comprobación |
|---|---|
| Fallar el rename pierde el principal | Fallo inyectado con principal legible, respaldo y limpieza del temporal |
| Archivo enorme agota memoria o versión futura se borra | Lectura limitada, cuota, rechazo sin cuarentena de versión futura |
| Descartar permite resucitar `.bak` tras interrupción | Falla inyectada al borrar respaldo; lápida prevalece al reiniciar store |
| Lector/escritor de otra instancia supera un descarte | Cola por ruta entre instancias y lectura posterior con sesión vacía |
| Navegar/cerrar sobrescribe una recuperación todavía no elegida | Espía de guardados: ninguno; sesión previa permanece |
| Cambio de cuenta abre una vista en la partición saliente | Aperturas rechazadas durante E/S; última transición prevalece |
| Lectura tardía contamina otra ventana/cuenta | Cambio de generación y pruebas con promesas diferidas |
| Restaurar conserva estado fullscreen de una pestaña destruida | Host vuelve a su estado anterior y vistas antiguas cerradas |
| División toma como secundaria una ventana separada | Caso negativo y corrección del selector automático |

## Riesgo residual y límites

La tarea 3.7 queda cubierta con regresiones automatizadas. 8.7 permanece abierta
porque sólo se completó la parte de sesiones, no todas las migraciones de stores.
El plan suma 29 de 64 tareas completas; no se archiva.

No se hizo smoke de Electron, cierre real del proceso, cortes eléctricos ni
creación fallida de ventanas nativas. El cierre solicita guardado asíncrono;
falta una barrera de flush `before-quit` y validación Windows. El flag de
restauración continúa apagado por defecto. No se restauran geometría, zoom,
formularios, navegación atrás/adelante ni pantalla completa.

El respaldo rota una sola generación; v1 sólo queda garantizado tras el primer
guardado de migración. Antes de downgrade conservar copia con la app detenida.
Los archivos en cuarentena no se cargan y permanecen para diagnóstico manual;
descartar no equivale a borrado seguro del disco. No se prometen RPO/RTO.

No hubo despliegue, instalación de runtime, comunicación externa, cambio de
secretos, commit, PR ni integración en el checkout original.
