## Context

Ver `proposal.md — Why` para la motivación.

Estado actual relevante para el diseño:

- `MemoryService` (`electron/memory-service.ts`) es una clase cuyos métodos se
  adjuntan por módulos al prototipo (`service-messages`, `service-summary`,
  `service-facts`, `skills-store`, `service-context`, `service-embedding`). Todos
  operan **sincrónicamente** sobre `this.db`, un `node:sqlite` abierto en
  `userData/soflia-memory.db`. `saveMessage` inserta y dispara el resumen en el
  mismo turno; `assembleContext` es la única ruta ya asíncrona.
- El alcance por dueño existe y es puro: `electron/memory/scope.ts` produce
  `user:<id>`, `phone:<numero>` o `local:owner`. Los mensajes ya llevan
  `owner_key`; las skills se aíslan por `owner_key`; los hechos usan la columna
  heredada `phone_number` como clave de alcance.
- Main ya tiene identidad: el cambio `authenticate-main-for-user-data` (aplicado)
  le entrega la sesión Supabase del usuario y `getHubDbClient()` la lleva, así que
  `auth.uid()` es real en el proceso main. Sin esa base, este cambio no puede
  escribir nada bajo RLS.
- El recuerdo semántico guarda el embedding como texto y calcula la similitud
  coseno en JavaScript (`service-embedding.ts`, `embedding-search.ts`). La
  instancia del Hub no usa `pgvector` hoy.
- La memoria alimenta un turno del agente. Una latencia añadida en la ruta de
  lectura se paga en cada mensaje, en cuatro superficies (chat, WhatsApp,
  escritorio, investigación).

## Goals / Non-Goals

**Goals:**

- La base de datos es la fuente de verdad de la memoria del usuario autenticado;
  el equipo conserva una copia utilizable sin red.
- Ninguna ruta de lectura del agente se vuelve dependiente de la red: el turno
  nunca espera a Supabase.
- El aislamiento por dueño lo garantiza Postgres (RLS), no el código cliente.
- La migración de lo existente es automática, idempotente y sin pérdida.

**Non-Goals:**

- Reescribir `MemoryService` a una API asíncrona completa: el diseño evita ese
  refactor manteniendo SQLite como capa síncrona.
- Resolución de conflictos con historial (CRDT, vector clocks): la convergencia
  es por última escritura y refuerzo, coherente con el `saveSkill` actual.
- Sincronizar embeddings entre equipos en la primera entrega (ver Decisión 5).

## Decisions

### 1. SQLite se conserva como caché local, no se elimina

El agente escribe y lee siempre contra SQLite —sin cambiar la firma síncrona de
`saveMessage`, `saveFact` ni `saveSkill`— y un sincronizador aparte replica hacia
Supabase. Alternativa descartada: escribir directo a Supabase y borrar SQLite.
Habría convertido cada `saveMessage` en una llamada de red dentro del turno del
agente, y una caída de Supabase habría dejado a SofLIA sin memoria y sin
resúmenes. La memoria es una capacidad local del producto de escritorio; la nube
le da portabilidad, no le da existencia.

### 2. Un diario de sincronización, no un "dirty flag" por fila

Cada escritura local con owner sincronizable anota una entrada en una tabla local
`sync_outbox` (entidad, id local, operación, timestamp). El sincronizador la
drena en lotes con reintento exponencial. Alternativa descartada: marcar filas
como pendientes y barrer las tablas; obliga a recorrer la memoria completa y no
sabe representar un borrado (la fila ya no está).

### 3. Identidad de fila estable entre equipos

Cada entidad sincronizable lleva un `uuid` generado en el equipo, además de su
`id` autoincremental local. La base usa ese `uuid` como clave natural con
`ON CONFLICT` para que dos equipos que suben la misma fila converjan en una. Para
las skills, la clave de convergencia sigue siendo la que ya existe
(`owner_key, skill_type, title`) y la fusión conserva la semántica actual:
refuerzo de confianza y contenido más reciente.

### 4. Nombres con prefijo `agent_memory_`

La instancia del Hub ya tiene `public.messages` (transcripciones de conversación)
y `public.skills` (Skills invocables del usuario). Llamar `messages` o `skills` a
las tablas de memoria del agente sería una colisión semántica que ningún RLS
arregla. Alternativa descartada: un esquema `memory` propio; el proyecto mantiene
todo en `public` con prefijos, y cambiar esa convención por una capacidad no lo
justifica.

### 5. Los embeddings viajan como dato; la similitud sigue en el cliente

`agent_memory_chunks` guarda el vector como `jsonb`/`text` igual que hoy y el
cálculo coseno permanece en JavaScript sobre los chunks hidratados. Alternativa
considerada: `pgvector` con búsqueda en Postgres. Es la evolución natural y la
tabla se diseña para admitirla (columna dedicada, índice añadible después), pero
exige habilitar la extensión, mover el ranking al servidor y volver a validar la
calidad del recuerdo. Es un cambio propio, no un efecto colateral de la
portabilidad.

### 6. Hidratación por prioridad al iniciar sesión

Al restaurar la sesión, main descarga primero lo que cambia el comportamiento del
agente y es pequeño —skills y hechos—, y después, en segundo plano, resúmenes,
chunks y mensajes recientes acotados por antigüedad. Alternativa descartada:
descargar todo antes de habilitar el chat; en una cuenta con historial largo el
usuario esperaría al arranque para escribir su primer mensaje.

### 7. El borrado es una operación de primera clase

`deleteSkill` y `deleteFact` anotan la baja en el diario y borran en la base. Un
borrado nunca se resuelve por ausencia de fila: sin registro explícito, la
siguiente hidratación reviviría lo que el usuario mandó olvidar.

## Risks / Trade-offs

- **Divergencia entre equipos abiertos a la vez** → convergencia eventual con
  última escritura ganadora; las skills además se refuerzan en vez de pisarse,
  que es el caso que más importa. Se documenta como límite explícito en la spec.
- **Fuga de memoria personal si una política RLS queda mal** → una sola política
  por tabla, siempre sobre `auth.uid() = user_id`, sin políticas para `anon`, y
  una prueba de aislamiento entre dos usuarios en la verificación del cambio.
- **Contenido sensible saliendo del equipo** → la memoria del usuario ya sale
  hacia el modelo en cada turno; lo nuevo es la persistencia. Se mitiga con RLS,
  con que la memoria sin dueño nunca suba y con que el olvido borre en ambos
  lados. Cifrado en reposo del lado del cliente queda fuera (no objetivo).
- **Crecimiento de la tabla de mensajes** → la sincronización de mensajes se
  acota por antigüedad y la compactación existente (`compactOldData`) pasa a
  propagarse; los resúmenes y las skills, que son lo que personaliza, no se
  acotan.
- **Doble fuente de verdad durante la transición** → el diario y las claves por
  `uuid` hacen la subida idempotente; la marca de migración por equipo evita que
  una reinstalación duplique el historial.

## Migration Plan

1. Aplicar la migración SQL en la instancia del Hub (tablas, índices, RLS). Sin
   clientes nuevos, no cambia nada del producto instalado.
2. Publicar la versión con el sincronizador **apagado por bandera**; verificar en
   un equipo real que la memoria local sigue intacta.
3. Encender la subida: al iniciar sesión, migración única de la memoria local con
   owner `user:<id>` y drenado del diario.
4. Encender la hidratación: un equipo nuevo con la misma cuenta debe mostrar las
   skills aprendidas en la tarjeta *Memoria de IA*.
5. **Rollback**: apagar la bandera. El producto vuelve a operar solo con SQLite,
   que nunca dejó de ser válido. La tabla remota se conserva; el bloque
   `ROLLBACK` de la migración la retira si se decide abandonar el cambio.

## Open Questions

- Antigüedad máxima de los mensajes que se sincronizan (los resúmenes y las
  skills sí viajan completos). Se puede fijar durante la implementación con el
  tamaño real de una base madura.
- Si la hidratación debe traer los chunks de conversación o basta con recalcular
  embeddings en el equipo nuevo a partir de los resúmenes sincronizados.
