## Context

Ver propuesta/context-pack. EventEmitter conserva ejecución síncrona, pero no
identidad de negocio. Las colas pueden arrancar desde el finally de otra tarea.

## Goals / Non-Goals

Probar procedencia y vigencia de publicaciones/respuestas de tareas y del
aprendizaje, sin convertir el payload/modelo en autoridad. No declarar aisladas
las mutaciones de estado interno/caches/perfiles o todas las acciones físicas.

## Decisions

- Contexto AsyncLocalStorage por servicio/tarea con identidad main, señal,
  invalidación A/B/A y vida hasta completar trabajo. Anidar conserva la lease;
  una continuación revocada no puede capturar identidad nueva como fallback.
- EventEmitter del servicio filtra publicaciones de tareas y copia payloads.
  Procedencia privada WeakMap y snapshot de texto para aprendizaje, sin campos
  serializables de autoridad ni confianza en taskId/ownerKey aportados.
- Validar forwarding antes de modificar marcas/status; eventos de backend sin
  contexto atribuible no publican. No asignar propiedad al usuario activo receptor.
- Capturar ejecución de cada cola al encolar usando AsyncResource.bind del core.
  Su despacho no hereda la identidad del trabajo que liberó plaza. Las señales
  existentes y la lease siguen impidiendo publicaciones al revocar.
- Memoria admite sólo eventos terminales de procedencia vigente, deduplicados
  por evento. Revalida antes de cada escritura y usa propietario originario.
- No copiar conversaciones/secretos a logs; DTO y canales permanecen intactos.

## Risks / Trade-offs

- Un emisor interno sin contexto pierde publicación → fallar cerrado, cubrir las
  entradas productivas y conservar pruebas de colas/backend legítimos.
- Leer estado global no es publicación de evento → permanece deuda separada,
  no esconderla con una afirmación de aislamiento general.
- Dos saveMessage no son transacción → revalidar entre ambas, no escribir en
  otra cuenta ni prometer atomicidad de aprendizaje ante error/revocación.
- Memoria entrega evento tras finalizar lease → se rechaza; el consumo actual
  es síncrono, no existe autorización durable de replay.

## Migration Plan

Sin formatos persistentes, dependencias o canales nuevos. Respaldos TEMP frente
a unidad 44; conservar índice ajeno. Pruebas causales/dominio/colas y servicio,
compuerta/cobertura y build aislado con hashes. No GUI ni cuentas reales.
Revisión independiente pendiente, sin archivar.
