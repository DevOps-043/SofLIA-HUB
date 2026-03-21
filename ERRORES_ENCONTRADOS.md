# Errores Encontrados - Matriz de Pruebas SofLIA Hub

**Fecha de verificacion:** 2026-03-21
**Framework:** Vitest 4.1.0
**Version de release objetivo:** 0.1.15
**Estado final:** Resuelto

## Resultado final verificado

- Suites ejecutadas: 30
- Tests ejecutados: 544
- Tests aprobados: 544
- Tests fallidos: 0
- Tasa de exito: 100%

**Comandos ejecutados para validar**

```powershell
npm.cmd rebuild better-sqlite3
npm.cmd test
```

**Evidencia**

- Reporte JSON actualizado: `tmp/vitest-report-after-fixes.json`
- Ultima corrida completa: `30 passed`, `544 passed`, `0 failed`

---

## Resumen ejecutivo

La version anterior de este documento describia una corrida intermedia con multiples diagnosticos incorrectos. Despues de revisar las suites, corregir mocks, mejorar el harness de pruebas y recompilar `better-sqlite3` para la version actual de Node, la bateria completa quedo en verde.

No quedan fallos abiertos reproducibles en la suite de Vitest al momento de esta verificacion.

---

## Causas raiz reales que se corrigieron

### 1. Mocks con rutas incorrectas y dependencias incompletas

Se corrigieron tests que mockeaban modulos hermanos con rutas equivocadas o con APIs parciales.

**Impacto corregido**

- `electron/__tests__/computer-use-handlers.test.ts`
- `electron/__tests__/desktop-agent-service.test.ts`
- `electron/__tests__/proactive-autodev.test.ts`

**Ejemplos corregidos**

- Mock incompleto de `node:child_process` sin `execFile` y `spawn`
- Mock de `background-process-service` apuntando a ruta incorrecta
- `vi.mock()` hoisteado usando variables aun no inicializadas

### 2. Mocks de constructores incompatibles con `new`

Varias suites usaban `vi.fn(() => ({ ... }))` para clases que en produccion se instancian con `new`. Eso hacia fallar `GoogleGenerativeAI` y servicios relacionados.

**Impacto corregido**

- `electron/__tests__/whatsapp-agent.test.ts`
- `electron/__tests__/whatsapp-audio-processor.test.ts`
- `src/__tests__/services/gemini-chat.test.ts`

### 3. Harness de renderer incompleto

El entorno de renderer no tenia `localStorage`/`sessionStorage` funcionales, lo que rompia pruebas antes de llegar a la logica real.

**Impacto corregido**

- `test/setup-renderer.ts`
- `src/__tests__/services/chat-service.test.ts`

### 4. Mocks de query builder insuficientes

Varias pruebas de Supabase simulaban cadenas incompletas y no reflejaban el comportamiento real de `.select()`, `.eq()`, `.order()`, `.limit()`, `.single()` y `.upsert().select().single()`.

**Impacto corregido**

- `src/__tests__/services/chat-service.test.ts`
- `src/__tests__/services/iris-data.test.ts`

### 5. Imports o expectativas desactualizadas

Algunas suites fallaban por expectativas viejas o por importar exports incorrectos, no por fallos del codigo productivo.

**Impacto corregido**

- `src/__tests__/components/Sidebar.test.tsx`
- `electron/__tests__/whatsapp-tools.test.ts`
- `electron/__tests__/preload.test.ts`
- `electron/__tests__/integration-edge.test.ts`

### 6. Dependencia nativa recompilada para el Node actual

`better-sqlite3` estaba compilado para otro `NODE_MODULE_VERSION`, por eso `memory-service.test.ts` fallaba aunque el test en si no estuviera roto por logica.

**Accion aplicada**

```powershell
npm.cmd rebuild better-sqlite3
```

**Impacto corregido**

- `electron/__tests__/memory-service.test.ts`

### 7. Rechazo no manejado durante la corrida global

La suite `agent-task-queue.test.ts` pasaba en asserts pero dejaba una `Unhandled Rejection`, lo que hacia que `vitest` terminara con error global.

**Impacto corregido**

- `electron/__tests__/agent-task-queue.test.ts`

---

## Suites clave que quedaron corregidas

Las siguientes suites estaban reportadas como fallando en la revision previa y ya quedaron validadas en verde:

- `electron/__tests__/computer-use-handlers.test.ts`
- `electron/__tests__/desktop-agent-service.test.ts`
- `electron/__tests__/memory-service.test.ts`
- `electron/__tests__/preload.test.ts`
- `electron/__tests__/proactive-autodev.test.ts`
- `electron/__tests__/whatsapp-service.test.ts`
- `electron/__tests__/whatsapp-agent.test.ts`
- `electron/__tests__/whatsapp-audio-processor.test.ts`
- `electron/__tests__/whatsapp-tools.test.ts`
- `electron/__tests__/integration-edge.test.ts`
- `src/__tests__/services/chat-service.test.ts`
- `src/__tests__/services/gemini-chat.test.ts`
- `src/__tests__/services/iris-data.test.ts`
- `src/__tests__/components/Sidebar.test.tsx`

---

## Diagnosticos de la version anterior que quedaron invalidados

Estos puntos del reporte previo resultaron incorrectos tras la verificacion real:

- `computer-use-handlers` no fallaba por export faltante; fallaba por mocks rotos.
- `memory-service` no fallaba por logica de negocio; fallaba por ABI de `better-sqlite3`.
- `SEC-026` no demostraba un fallo real de CSP; el test estaba inspeccionando el source de forma demasiado amplia.
- `desktop-agent` no fallaba porque `loadConfig`/`saveConfig` no existieran; si existen y estan exportadas.
- `Sidebar` no fallaba por markup incompatible; fallaba por importar default export donde el componente real es export nombrado.
- `chat-service` no fallaba primero por Supabase; fallaba antes por ausencia de `localStorage.clear`.
- `integration-edge` mezclaba checks sinteticos con expectativas incorrectas.

---

## Estado actual

**Conclusión:** la matriz de pruebas queda actualizada como **resuelta** para la corrida del 2026-03-21.

No hay fallos pendientes documentables en Vitest despues de las correcciones aplicadas y de la recompilacion nativa necesaria para `better-sqlite3`.
