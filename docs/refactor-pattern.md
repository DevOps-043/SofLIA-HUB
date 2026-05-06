# Patrón de refactor — modularización segura

Documento operativo para los próximos refactors de archivos monolíticos.
Validado con `chat-service.ts` (938 líneas → 11 módulos cohesivos, 0 regresiones).

---

## Reglas no negociables

1. **No cambiar la API pública** durante el refactor. El archivo histórico
   se convierte en barrel (`export * from ...`) para preservar imports.
2. **Tests verdes en cada commit**. Si algo se rompe, abortar antes de seguir.
3. **Una responsabilidad por módulo nuevo**. Si dudas si un archivo "hace
   demasiado", dividirlo aunque quede de 50 líneas.
4. **Sin lógica nueva durante el refactor**. Mover código, no reescribirlo.
   Mejoras lógicas van en commits separados.
5. **Ningún módulo nuevo > 300 líneas**. Si pasa, falta otra subdivisión.

---

## Estructura objetivo

Para cualquier servicio mediano-grande, dividir en estas capas:

```
servicio/
├── types.ts          # contratos puros (interfaces, types, constantes)
├── normalize.ts      # funciones puras de transformación
├── cache.ts          # acceso a storage local (localStorage / IndexedDB)
├── pending-state.ts  # cola de cambios pendientes (offline-first)
├── builders.ts       # composición de datos remotos + locales
├── recovery.ts       # detección de cambios locales no sincronizados
├── remote.ts         # único punto que conoce Supabase / API externa
├── sync.ts           # orquestador del sync (local → remoto)
├── migration.ts      # migraciones puntuales (legacy users, schema bumps)
├── operations.ts     # API pública: orquesta capas, no contiene lógica baja
└── index.ts          # barrel: re-exporta SOLO lo público
```

No todos los servicios necesitan las 11 capas. La regla es: **si un concepto
tiene su propio vocabulario (cache, pending state, remote, etc.), merece archivo**.

---

## Flujo paso a paso

### 1. Mapear las exports actuales

```bash
grep -nE '^export (function|const|interface|type|async function)' archivo.ts
```

### 2. Mapear los imports externos

```bash
grep -rn "from.*archivo-service" src/
```

Esto define la **superficie pública** que NO debe cambiar.

### 3. Clasificar cada función/tipo en una capa

| Función hace... | Va a |
|---|---|
| Solo transforma datos sin IO | `normalize.ts` |
| Lee/escribe `localStorage` | `cache.ts` |
| Habla con Supabase/API | `remote.ts` |
| Mezcla local + remoto | `builders.ts` |
| Encola cambios pendientes | `pending-state.ts` |
| Ejecuta el sync | `sync.ts` |
| Es endpoint público | `operations.ts` |

### 4. Crear los módulos en orden de dependencia

Las capas bajas (types, normalize) primero. Las altas (operations) al final.
Cada módulo puede importar SOLO de capas más bajas — nunca al revés.

### 5. Reemplazar el archivo original por un barrel

```typescript
// archivo-service.ts (después del refactor)
export type { Foo, Bar } from './archivo';
export { fnA, fnB, fnC } from './archivo';
```

### 6. Validar

```bash
npx tsc --noEmit              # sin errores nuevos
npx vitest run                # mismo pass rate que antes
```

Si algo rojo: revertir, no avanzar.

---

## Reglas de dependencia entre módulos

```
types ← (todos los demás)
normalize ← cache, builders, recovery, remote, sync, migration, operations
cache ← pending-state, builders, recovery, sync, operations
pending-state ← builders, recovery, sync, operations
builders ← operations
recovery ← operations
remote ← sync, operations
sync ← operations
migration ← (independiente, solo importa types/cache/normalize)
operations ← index
index ← archivo-service (barrel)
```

**Regla de oro:** si un módulo necesita importar de `operations.ts`, está mal
ubicado — operations es el único nivel "alto".

---

## Beneficios concretos medidos en `chat-service`

| Métrica | Antes | Después |
|---|---|---|
| Líneas en archivo principal | 938 | 21 (barrel) |
| Archivo más grande | 938 | 260 (`remote.ts`) |
| Archivos > 200 líneas | 1 | 2 |
| Archivos < 100 líneas | 0 | 7 |
| Concerns mezclados | 6 (types/cache/pending/remote/sync/ops) | 0 |
| Funciones puras testeables aisladas | ~30% | ~70% |

---

## Próximos candidatos por prioridad

1. `electron/desktop-agent-service.ts` (2,527 líneas) — separar Perception/Planning/Action
2. `electron/whatsapp-agent.ts` (1,631 líneas) — extraer ToolExecutor del agentic loop
3. `electron/workspace-automation-service.ts` (1,628 líneas) — un archivo por template
4. `electron/iris-data-main.ts` (1,410 líneas) — repository pattern por entidad
5. `electron/computer-use-handlers.ts` (1,352 líneas) — handlers por dominio (fs, shell, system)

Cada uno sigue el mismo patrón: types → capas bajas → operations → barrel.

---

## Infraestructura disponible para los nuevos módulos

- **Logger estructurado:** `electron/utils/logger.ts` — `createLogger('module-name')`
- **Correlation IDs:** `electron/utils/correlation.ts` — `withCorrelation(fn)` en boundaries
- **Result type:** `electron/utils/result.ts` — `Result<T, AppError>` en lugar de throws/null
- **IPC helpers:** `electron/utils/ipc-helpers.ts` — `handleIPC(fn)` para handlers

Usarlas en código nuevo. Migrar código existente a estas utilidades es un paso
independiente del refactor estructural — no mezclar ambos en el mismo PR.
