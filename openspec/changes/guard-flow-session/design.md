## Context

Los reintentos y fallback comparten entrada privada; un cambio de sesión durante
una espera no debe iniciar trabajo nuevo ni devolver la respuesta anterior.

## Decisions

Observar eventos de sesión antes de la primera espera y comprobar vigencia al
terminar cada etapa, incluso ante error. Reutilizar la misma guarda en el fallback;
liberar siempre la suscripción. Las llamadas ya enviadas no se revierten.
La protección es local y no sustituye autenticación o autorización del servidor.
