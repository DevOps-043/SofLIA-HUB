## Context

Ver proposal/context-pack. El dispatcher común también sirve rutas runtime;
esta unidad protege el acceso renderer sin conceder permisos a esas otras rutas.

## Goals / Non-Goals

Validar las tuplas existentes, ligar autorización a fuente/revisión, confirmar
efectos en main y conservar las cuatro capas. No certificar rutas runtime ni
cancelación/atomicidad de servicios heterogéneos ya invocados.

## Decisions

- Schema por canal con Zod existente y snapshot descriptor/UTF-8 acotado. Evitar
  casts de funciones heterogéneas o un objeto permisivo universal.
- Contexto trustedAppCaller existente con getters Hub/Orbe desde startup;
  default sin ventanas deniega, sin fallback a cualquier BrowserWindow.
- Un trabajo por emisor y cuatro globales, incluyendo esperas de aprobación;
  retener plazas hasta terminar I/O físico, sin cola. Fuente revocada impide
  progresos y publicación; efectos ya despachados pueden terminar.
- Confirmación nativa del snapshot con digest y resumen sin contraseña SMTP.
  No confiar en confirm-action ni aprobación persistida del renderer. El diálogo
  nativo existente limita concurrencia y tiempo. No guardar autorización durable.
- Capability opcional readonly en preload permite omitir aprobación renderer
  sólo para herramientas locales cubiertas; Desktop Agent y otras rutas conservan
  sus guardas. Clientes anteriores pueden mostrar dos confirmaciones.
- Mantener éxito del servicio; errores IPC fijos evitan reflejar excepciones
  privadas. No imprimir argumentos, secretos ni contenido.

## Risks / Trade-offs

- I/O admitido no es transaccional → distinguir revocación de publicación y
  cancelación física, sin prometer deshacer efectos.
- Contenido largo → mostrar longitud/hash y preview marcado; no truncar el
  destino/comando/destinatarios al revisar. Argumentos quedan copiados.
- El usuario puede denegar nuevas aprobaciones → devolver cancelación sin efecto.
- GUI heredada usa shell → no declarar saneamiento del backend por validar IPC;
  queda deuda específica y no se ejecuta GUI real para verificar esta unidad.

## Migration Plan

Actualizar main/preload/renderer juntos, sin canales o dependencias nuevos.
Respaldos relativos TEMP y reversión sólo del delta de unidad 42, preservando
índice ajeno. Compuerta global, cobertura y build aislado antes de entregar.
Revisión independiente requerida antes de archivar.
