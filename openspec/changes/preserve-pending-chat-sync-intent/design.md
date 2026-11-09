## Context

Ver propuesta y Context Pack. `saveMessages` también escribe cache antes de
esperar su propia cadena: el cache puede estar más adelantado que la cola.
Por eso condicionar únicamente la retirada de pendientes no protege publicación.

## Goals / Non-Goals

**Goals:** ordenar efectos de esta identidad dentro del mismo renderer,
conservar contenido pendiente nuevo y evitar publicación atrasada sobre cache.

**Non-Goals:** CAS de servidor, bloqueo entre ventanas/equipos, revocar I/O enviado,
rehacer autorización o prometer persistencia si localStorage falla.

## Decisions

- `sync.ts` conserva firma pública y coordina una pasada activa más una pendiente
  por identidad. La pendiente fusiona IDs dirigidos; una petición global absorbe
  filtros. Cada lote tiene una promesa compartida y conserva sus errores; fallar
  una pasada no impide procesar la pendiente. Se retira el coordinador al quedar
  vacío. No acumular una cadena nueva por cada autosave ni descartar filtros.
- Separar la pasada en `sync-pass.ts`: borrados, conversaciones y mensajes siguen
  en ese orden. Revalidar entrada antes de enviar y después de esperar; una
  eliminación/lápida evita publicar el contenido revocado.
- `pending-state/clear.ts` reconoce contenido esperado mediante DTO normalizado
  y comparación JSON conservadora, en lectura/escritura síncrona sin await.
  Contenido idéntico representa la misma intención idempotente; no se añaden
  tokens o metadatos persistentes. Diferencias de orden JSON pueden conservar
  una entrada para otra pasada, nunca justificar retirar contenido diferente.
- El writer local devuelve éxito booleano; reconocer una entrada requiere
  confirmar escritura/retirada. Sus otros callers conservan uso compatible.
  Una cola heredada con borrado y payload del mismo ID da prioridad al borrado:
  reconocerlo retira esos payloads, evitando recreación en la misma pasada.
- Capturar revisión efímera del cache antes de esperar: sólo es elegible si
  estaba ausente o coincidía con el contenido enviado; sólo se publica si su
  valor persistido sigue idéntico. Esto protege también cache adelantado a la
  cola. Un cambio ajeno en la misma clave puede omitir un refresco canónico;
  se conserva el dato local y la siguiente lectura remota lo reconcilia.
- Compartir comparación pura entre reconocimiento y revisión del cache. Ningún
  componente incorpora persistencia/red; no hay nuevas dependencias o IPC.
- Mantener rechazo permanente/transitorio y de otra identidad. Los avisos de
  esta pasada son estáticos, sin IDs ni mensajes libres del proveedor. El resto
  de la telemetría remota conserva su propia deuda, sin declaración de redacción global.

## Risks / Trade-offs

I/O ya enviado → puede producir efecto; conservar intención posterior para la
siguiente pasada, sin fingir cancelación. Otros renderers/equipos → sin CAS
remoto no se ofrece orden global. LocalStorage → no hay transacción entre
ventanas ni durabilidad garantizada; si falla no se acredita reconocimiento.
Payload corrupto → normalización previa conserva límites existentes; no se
introduce migración ni se inventan fechas. Identidades distintas → coordinación
independiente, sin prometer resolución de ediciones simultáneas multiusuario.

## Migration Plan

Regresiones con servicios remotos sustituidos y storage real de jsdom; luego
coordinador/pasada/reconocimiento/cache, consumidores, docs y gate/build congelados.
Sin migración de datos. Reversión selectiva conserva formato/contratos y exige
mantener protección contra publicación/retirada obsoletas; no deshacer unidades
anteriores para obtener verde. Revisión independiente pendiente antes de archivar.
