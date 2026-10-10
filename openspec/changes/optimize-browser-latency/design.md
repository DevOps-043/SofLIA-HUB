## Context

Ver [propuesta](proposal.md) y [contexto](context.md). El servicio compilado
es el sujeto del benchmark; los frames y recursos son locales, sin perfil Google.

## Goals / Non-Goals

**Goals:** reducir espera del control humano, IPC y consultas DOM redundantes.
**Non-Goals:** alterar tiempos de servidores externos o relajar protección.

## Decisions

- DEC-LAT-01: opción `waitForLoad` tipada y validada como booleano en los
  canales existentes, por defecto true. Solo la UI solicita false. El agente
  renderer, driver y openForAgent mantienen espera completa. No hay canales
  nuevos; preload transporta únicamente la opción conocida y conserva payload
  previo cuando se omite.
- DEC-LAT-02: observar la promesa de loadURL aunque el acuse ya se haya enviado;
  publicar fallo contra instancia/perfil/documento vigentes. No dejar rechazos
  sin manejar ni errores que caigan en otra pestaña.
- DEC-LAT-03: viewport idéntico visible devuelve estado sin layout/emisión.
  React agrupa ResizeObserver/window.resize con RAF y no repite el mismo IPC;
  hide/restauración invalidan la deduplicación para conservar overlays.
- DEC-LAT-04: teclas ordinarias dejan de disparar el sondeo global. Selección
  real usa selectionchange; conservar mouseUp como respaldo para iframes
  dinámicos y atajos de selección. El vigía filtra selecciones colapsadas.
  Las lecturas son de solo lectura y no sintetizan activación del usuario.
- DEC-LAT-05: ignorar selección si el documento, vista, perfil o pestaña activa
  ya cambió. No optimizar conservando contenido obsoleto.
- DEC-LAT-06: recarga no interna del renderer principal o pérdida de su proceso
  oculta las vistas del workspace e invalida su geometría y operaciones previas.
  Conserva pestañas, sesión web y ventanas separadas. Detiene la tarea supervisada
  manteniendo su reserva hasta terminar limpieza, invalida guardas y deniega
  avisos cuya UI desapareció. Reabrir exige un viewport del panel nuevo.
- DEC-LAT-07: sugerencias ligadas al texto consultado. Al editar se retiran los
  resultados anteriores sin esperar IPC; debounce conserva 140 ms y al cerrar
  o desmontar se ignoran respuestas en vuelo. No añadir caché de historial.
  La barra se remonta por `profileRevision` para retirar resultados del perfil anterior.
- DEC-LAT-08: cierre múltiple conserva orden de cierre, historial y selección,
  pero aplica layout y publica su resultado al terminar. No materializar
  pestañas suspendidas que se van a cerrar como destinos intermedios. Eventos
  de carga posteriores de la pestaña restaurada conservan su publicación.
  Retirar fullscreen y normalizar selección antes de limpiar recursos nativos;
  un fallo de limpieza conserva estado parcial válido y retira la página.
- DEC-LAT-09: `docs:inventory:sync` actualiza cifras derivadas de Git mediante
  una opción explícita del validador. La compuerta mantiene lectura estricta y
  sigue rechazando cifras obsoletas; no modifica documentación implícitamente.

## Risks / Trade-offs

- Acuse no equivale a documento disponible → contrato explícito y agente con
  espera completa; errores tardíos publicados en estado.
- Deduplicación conserva vista oculta → invalidar geometría tras hide y forzar
  restauración, con pruebas de overlays y cambio de insets.
- Filtrar escritura pierde selección por teclado → cubrir Shift+arrows y
  Ctrl/Meta+A, beacon real y deselección de un fragmento existente.
- Contenido remoto tarda igual → reportar acuse/consultas/emisiones, sin confundir
  el benchmark local con tiempo remoto de carga o llamada.

## Migration Plan

Sin migración ni dependencia nueva. Integrar archivos revisados, compilar y
repetir benchmark y smoke. Rollback: revertir este diff; conservar arreglo Huddle.
