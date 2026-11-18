## Context

La captura muestra sólo el mensaje de la persona, sin respuesta ni carga.
AppContent usa currentConversationId en la key de ArtifactViewerProvider, que
envuelve AppWorkspace. Al persistir el primer mensaje pasa de null al UUID
reservado. React desmonta al controlador del turno, cuyo cleanup aborta e
invalida la generación. El nuevo ChatUI oculta el placeholder heredado.

La regresión reproduce señal abortada y error no publicado sin un proveedor real.
Es evidencia de una causa suficiente; no acredita el estado de la API del equipo.

## Goals / Non-Goals

Conservar la respuesta y su estado de espera al guardar el primer mensaje.
Mantener cancelación y limpieza del visor al abrir otro chat, otro usuario u
otra organización. No cambiar modelos, guardas, datos ni transporte del agente.

## Decisions

Usar chatScopeId, ya estable entre borrador y conversación guardada, en la clave
del proveedor. Conservar usuario SOFIA y organización como parte de esa clave.
No retirar la clave: eso conservaría archivos seleccionados de otro chat.

## Risks / Trade-offs

Un ámbito nuevo debe seguir remontando el contenedor. Pruebas negativas cubren
nuevo borrador, cambio de usuario/organización y respuestas tardías. La inferencia
se simula: no se inspeccionan ni usan claves reales.

## Migration Plan

Cambio reversible de una expresión JSX, sin migración. Revertir esa expresión
restaura el comportamiento previo y su defecto. La aplicación ya abierta requiere
recarga del renderer para usar el código actualizado.
