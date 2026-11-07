## Purpose

Conservar las modificaciones locales vigentes del chat durante sincronizaciones
concurrentes, evitando retirarlas o sustituirlas con respuestas anteriores.

## ADDED Requirements

### Requirement: Orden local y scopes conservados
La sincronización MUST evitar efectos simultáneos de una identidad en el mismo
renderer. Solicitudes pendientes MUST conservar la unión de sus IDs; sólo una
solicitud global MUST ampliar el alcance a toda la cola. Identidades distintas
MUST poder progresar independientemente. Un fallo MUST NOT bloquear futuras pasadas.

#### Scenario: Dos guardados de la misma identidad
- **WHEN** se solicita otra sincronización mientras una espera red
- **THEN** sus efectos esperan la pasada activa y procesan después la intención vigente

#### Scenario: Fusión de alcance
- **WHEN** llegan solicitudes dirigidas a IDs distintos durante una pasada activa
- **THEN** ambas quedan cubiertas sin procesar IDs ajenos salvo petición global explícita

### Requirement: Reconocimiento del contenido enviado
Una respuesta MUST retirar sólo contenido pendiente que siga coincidiendo con
el enviado. Un cambio posterior MUST permanecer pendiente, tanto ante éxito
como ante rechazo permanente. Un fallo transitorio MUST conservar su entrada.

#### Scenario: Mensajes o título sustituidos durante la espera
- **WHEN** una respuesta anterior llega después de encolar otro contenido del mismo ID
- **THEN** el contenido nuevo permanece pendiente y disponible localmente

#### Scenario: Retirada local no confirmada
- **WHEN** falla la escritura local necesaria para reconocer una entrada
- **THEN** la sincronización no acredita su retirada ni publica un refresco dependiente de ella

### Requirement: Publicación de cache vigente
Una respuesta MUST NOT sustituir cache adelantado a la cola ni cache cambiado
durante su espera. La publicación canónica MUST exigir reconocimiento vigente
y revisión local del valor que se pretende refrescar.

#### Scenario: Cache nuevo antes de encolar
- **WHEN** un autosave ya actualizó cache y su entrada todavía espera turno
- **THEN** la respuesta de la versión anterior conserva ese cache más reciente

### Requirement: Borrado y autorización conservados
Borrados y lápidas MUST impedir que respuestas obsoletas repueblen cache o
inicien escrituras revocadas aún no enviadas. Contenido de otra identidad MUST
seguir excluido de escritura; la coordinación MUST NOT conceder permisos nuevos.

#### Scenario: Borrado durante una sincronización
- **WHEN** se purga o marca una conversación mientras una petición espera
- **THEN** su respuesta no recrea cache ni retira la intención de borrado pendiente

#### Scenario: Estado heredado contradictorio
- **WHEN** una entrada conserva borrado y payloads del mismo ID
- **THEN** el borrado mantiene prioridad y no se recrea desde esos payloads en la misma pasada
