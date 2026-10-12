## Context

Actor: usuario local autenticado. Sesión observada: Wayland, Firefox Snap,
GIO disponible y xdotool ausente. No se recuperó una traza del turno original;
no se atribuye a una llamada concreta lo que sólo muestra la captura.

## Goals / Non-Goals

Abrir una aplicación solicitada y distinguir lanzamiento, verificación y fallo.
No implementar control visual portable de Wayland, ampliar shell runtime,
modificar permisos ni cambiar proveedores conversacionales.

## Decisions

La búsqueda usa nombres exactos normalizados de desktop entries y binarios
ejecutables de PATH. GIO interpreta Exec y sus placeholders; el runtime no
interpreta comandos desktop como shell. Los procesos se lanzan con argumentos
separados y se detectan errores de spawn/salida temprana.

X11 usa xdotool con argumentos separados para localizar y activar ventanas.
Wayland conserva el lanzamiento pero devuelve window_verified=false y un
mensaje explícito; ningún fallo se convierte en «se abrió correctamente».
Una orden explícita, completa y de una sola apertura usa open_application
directamente, después de validar el catálogo del turno. Órdenes compuestas,
preguntas, adjuntos y Skills restringidas conservan el flujo existente.

## Risks

Una aceptación del launcher no prueba una ventana visible bajo Wayland.
No reintentar automáticamente un lanzamiento aceptado. No usar coincidencias
de título que puedan confundir el chat (cuyo título también incluye Firefox).
Rollback: revertir el cambio; no hay migraciones ni efectos persistentes nuevos.
