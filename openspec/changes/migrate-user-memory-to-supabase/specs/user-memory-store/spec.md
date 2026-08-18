## Purpose

Define de quién es la memoria que SofLIA aprende de una persona, dónde vive y
cómo viaja con ella entre equipos: qué se guarda en la base de datos bajo su
identidad, qué se queda en el equipo por no tener dueño autenticado, cómo se
hidrata, se sincroniza y se borra.

## ADDED Requirements

### Requirement: Propiedad de la memoria por usuario autenticado

La memoria del agente con owner `user:<id>` —mensajes, resúmenes, chunks, hechos
y skills aprendidas— SHALL persistir en la base de datos del Hub bajo el
`user_id` de la sesión Supabase, y SHALL ser legible y escribible únicamente por
su dueño.

#### Scenario: El dueño lee su memoria

- **WHEN** un usuario con sesión activa pide el contexto de memoria de su chat
- **THEN** el sistema devuelve únicamente filas cuyo `user_id` es el suyo

#### Scenario: Otro usuario no alcanza la memoria ajena

- **WHEN** una sesión autenticada consulta filas de memoria de otro `user_id`
- **THEN** la base de datos no devuelve ninguna fila y la operación no falla con
  datos parciales de otro dueño

#### Scenario: Sin sesión no hay lectura remota

- **WHEN** no hay sesión Supabase activa
- **THEN** el sistema no consulta la memoria remota y responde con la memoria
  local del equipo

### Requirement: La memoria sin dueño autenticado permanece local

La memoria cuyo owner no se puede atribuir a un usuario de `auth.users` —un
número de WhatsApp sin ligar (`phone:<numero>`) y el owner de equipo sin sesión
(`local:owner`)— SHALL permanecer únicamente en el equipo y NO SHALL subir a la
base de datos.

#### Scenario: WhatsApp sin número ligado

- **WHEN** el agente aprende algo en una conversación de WhatsApp cuyo número no
  está ligado a una cuenta SOFIA
- **THEN** lo guarda con owner `phone:<numero>` solo en el equipo y no lo publica
  en la base de datos

#### Scenario: Un grupo de WhatsApp nunca entra en la memoria personal

- **WHEN** el agente participa en un grupo de WhatsApp
- **THEN** el material del grupo conserva el alcance por teléfono y no se atribuye
  a la memoria personal de ningún usuario

#### Scenario: Se liga el número a una cuenta

- **WHEN** un número de WhatsApp se liga a un usuario SOFIA
- **THEN** su memoria local pasa a owner `user:<id>` y queda elegible para
  sincronizar, sin duplicar lo ya existente

### Requirement: La memoria sigue al usuario entre equipos

Al iniciar sesión en un equipo, el sistema SHALL hidratar la memoria del usuario
desde la base de datos, de modo que el agente aplique en ese equipo lo aprendido
en otro.

#### Scenario: Equipo nuevo con cuenta conocida

- **WHEN** un usuario inicia sesión en un equipo donde nunca usó el producto
- **THEN** sus skills aprendidas y sus hechos quedan disponibles para el agente en
  ese equipo, y la tarjeta *Memoria de IA* los muestra

#### Scenario: Reinstalación

- **WHEN** un usuario reinstala la aplicación y vuelve a iniciar sesión
- **THEN** conserva la memoria que tenía antes de reinstalar

#### Scenario: Cambio de usuario en el mismo equipo

- **WHEN** una sesión se cierra y otro usuario inicia sesión en el mismo equipo
- **THEN** el agente deja de leer la memoria del usuario anterior y no mezcla las
  dos

### Requirement: El agente nunca se queda sin memoria por falta de red

La escritura y la lectura de memoria SHALL funcionar sin conexión sobre el
almacén local, y la sincronización con la base de datos SHALL ser asíncrona,
reintentable y no bloqueante para el turno del agente.

#### Scenario: Turno con la base de datos caída

- **WHEN** el usuario conversa con SofLIA y la base de datos no responde
- **THEN** el turno se completa con la memoria local y lo aprendido queda pendiente
  de sincronizar, sin error visible que interrumpa la conversación

#### Scenario: Recuperación de la conexión

- **WHEN** la conexión se restablece
- **THEN** lo pendiente sube sin duplicar filas ya sincronizadas

#### Scenario: Dos equipos con la misma cuenta

- **WHEN** el mismo usuario aprende cosas en dos equipos y ambos sincronizan
- **THEN** las dos memorias convergen y una skill repetida queda como una sola
  fila reforzada, no duplicada

### Requirement: Migración única de la memoria local existente

La memoria local con owner `user:<id>` anterior a este cambio SHALL subir a la
base de datos una sola vez por equipo, de forma idempotente, sin borrar el
almacén local ni exigir intervención del usuario.

#### Scenario: Primera sesión tras actualizar

- **WHEN** el usuario inicia sesión por primera vez con la versión que incluye
  este cambio
- **THEN** su memoria local se publica bajo su `user_id` y queda marcada como
  migrada

#### Scenario: Reejecución de la migración

- **WHEN** la migración vuelve a ejecutarse en el mismo equipo
- **THEN** no crea filas duplicadas ni altera las que ya existen

#### Scenario: Memoria sin dueño durante la migración

- **WHEN** el almacén local contiene memoria con owner `phone:` o `local:owner`
- **THEN** la migración la conserva local y no la sube

### Requirement: El usuario controla y borra su memoria

La tarjeta *Memoria de IA* SHALL permitir ver y olvidar lo aprendido, y el
olvido SHALL alcanzar tanto al equipo como a la base de datos.

#### Scenario: Olvidar una skill aprendida

- **WHEN** el usuario pulsa *Olvidar* sobre una skill
- **THEN** la skill desaparece del equipo y de la base de datos, y deja de
  inyectarse en los turnos siguientes

#### Scenario: Olvido sin conexión

- **WHEN** el usuario olvida una skill sin conexión
- **THEN** deja de aplicarse de inmediato en el equipo y el borrado remoto queda
  pendiente hasta recuperar la conexión

#### Scenario: Estado de sincronización visible

- **WHEN** hay memoria pendiente de sincronizar
- **THEN** la interfaz puede informarlo sin exponer el contenido pendiente
