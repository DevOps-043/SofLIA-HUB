## Context

Los equipos generales emiten inicio/fin; Meeting Ops emite cambios de snapshot.
El navegador usa una vista nativa por encima del DOM, por lo que un panel HTML
superpuesto quedaría oculto. Se requiere una ventana Electron independiente.

## Goals / Non-Goals

Mostrar actividad verificable sin exponer fuentes, prompts, respuestas o claves.
Ocultar/minimizar no debe alterar el trabajo. No agregar controles de ejecución.

## Decisions

- Eventos con UUID, secuencia y estados por rol; observadores aislados de fallos.
- Main conserva hasta doce equipos recientes, sin disco. Limpia al cambiar sesión.
- Sólo el frame principal del Hub publica eventos renderer con propietario validado.
- La ventana auxiliar usa el mismo bundle React con entrada dedicada y preload
  restringido al monitor; no monta autenticación, chat ni conectores.
- Ventana nativa redimensionable, apertura sin foco y sin alwaysOnTop global.
  El sistema puede colocarla junto a la principal. Cerrar equivale a ocultar.
- IPC tipado para snapshot, publicar, mostrar/ocultar/minimizar y cambios.

## Risks / Trade-offs

Los estados de especialistas no describen el resultado final del coordinador.
La UI debe aclarar que finalizar preparación no significa terminar la tarea.
Eventos tardíos se descartan por secuencia y por identidad de sesión.

## Migration Plan

Sin migraciones. Retirar servicio, puente y entrada visual desactiva el monitor
sin cambiar la ejecución. El historial temporal desaparece al cerrar sesión.
