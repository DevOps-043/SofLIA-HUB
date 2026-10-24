## Context

Ver propuesta/context-pack. Voz y tools duplican framing, pendientes y listeners de proceso; los callbacks antiguos no verifican ownership. Voz usa ready v4 y tools ready v1; sus respuestas tienen envoltorios diferentes que deben seguir mapeando las fachadas.

## Goals / Non-Goals

**Goals:** transporte compartido por generación, preparación/cierre comprobables, recursos acotados y compatibilidad de consumidores.

**Non-Goals:** permisos IPC/micrófono, validación semántica completa de eventos/audio/documentos, modelos/descargas, Python empaquetado o cambios en los programas Python. No activar captura ni SDK durante QA.

## Decisions

- Conexión por ChildProcess, con ready único y versión esperada. La fachada asigna la conexión antes de conectar listeners; los callbacks comparan identidad. Stop desacopla la generación antes de esperar shutdown y bloquea nuevos arranques hasta terminar. El error/exit de un hijo retirado no cambia el actual.
- Si kill falla o devuelve false sin salida acreditada, devolver SIDECAR_STOP_UNCONFIRMED y bloquear reemplazo/restart hasta close real de ese hijo. La conexión conserva una promesa de cierre que libera sólo su propia retención. Spawn fallido sin PID no requiere kill. No afirmar cierre físico ante rechazo del SO.
- Respuestas y pendientes pertenecen a la conexión. Cierre/timeout/fallo rechazan o resuelven mediante la fachada, nunca se reenvían comandos automáticamente. Tools conserva ToolsResult y voz sus eventos/métodos.
- Readiness 10 s voz/15 s tools; shutdown hasta 2 s; plazos de comandos existentes 10/15/60/90 s. Exit antes de ready falla inmediatamente. Timeout/incompatibilidad mata la generación y limpia sus recursos. Listeners de error quedan protegidos hasta close, evitando excepciones tardías del EventEmitter.
- Framer UTF-8 estricto con buffer que crece acotadamente: línea de hasta 64 MiB para documentos y audio, sin conservar salida malformada. Payload saliente hasta 8 MiB, cola stdin hasta 8 MiB y 64 requests pendientes; timeout entero positivo hasta 300 s. Son políticas defensivas nuevas, no medidas de uso ni SLO. Meeting Live admite chunks muy inferiores y no se añade cola/retry. notify true significa aceptado una sola vez; backpressure de write no convierte un chunk ya encolado en rechazo.
- No registrar stdout/stderr crudos, transcripciones, documentos ni payloads. Error de transporte usa códigos/mensajes propios; spawn sólo expone código de SO permitido. Los errores semánticos existentes del sidecar siguen bajo responsabilidad del dominio, sin certificar redacción total del resto del servicio.
- Epoch de lifecycle y token de wake impiden que una operación anterior a stop restaure estado/micrófono. Cada stop, incluso reiterado, invalida arranques que esperaban el cierre. El reinicio válido puede reutilizar un hijo ya abierto por otro consumidor; usa la intención wake vigente y espera su ready. Reinicio de escucha conserva máximo tres intentos y delay 1/2/3 s, pero se cancela al parar/configurar disabled; timer revalida intención y conexión antes de actuar.
- No unificar los dominios Python: sólo comparten mecánica stdio. Mantener dos procesos y sus fachadas/eventos evita mezclar fallos o datos entre voz y documentos.

## Risks / Trade-offs

Límites explícitos rechazan cargas antes ilimitadas: error controlado, sin truncar ni declarar éxito. Un timeout no certifica rollback de un comando ya enviado; no hay retry automático. close/kill depende del SO, sin prometer que termina descendientes externos. La autorización IPC heterogénea y el entorno heredado del hijo quedan pendientes. El runtime Python del checkout no está disponible; el smoke de transporte debe declarar qué ejecutable/protocolo usa.

## Migration Plan

Baseline y pruebas rojas, conexión/framer compartidos, integración de las dos fachadas y cierre/restart, pruebas negativas y procesos reales ficticios, docs y gate/build. Revertir ambos servicios/transporte/tests/docs juntos, preservando quince unidades previas. No hay migración ni borrado de perfiles. Revisión independiente antes de archivar.
