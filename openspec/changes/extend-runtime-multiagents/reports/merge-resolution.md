# Resolución del merge y coherencia del catálogo

Fecha: 2026-10-05. Estado: verificado localmente.
Rama: `codex/fix-soflia-max-selector`.
Padres del merge: `acb6093` y `0fc980a` (`codex/research-user-value`).

## Diagnóstico y resolución

Se encontraron seis conflictos: inventario de pruebas, configuración, catálogo
del selector y tres archivos de pruebas. La integración automática combinaba
constantes de Max con identificadores y expectativas de otro catálogo.

Se conserva Luna como predeterminado y Gemini como Pro de la rama entrante,
junto con Max `gpt-6.1-sol` y su migración de preferencias de la rama actual.
Selector y cuota comparten constantes. Las preferencias `gpt-6-sol` también
migran a Max conservando el razonamiento; el valor vigente tiene prioridad.
Los mensajes de configuración y cuota corresponden al catálogo resultante.
El inventario se deriva de Git: 506 archivos, 354 de main, 151 de renderer
y uno de scripts. Se conservaron las demás modificaciones del merge.

## Evidencia

- `npm run test -- src/__tests__/hooks/model-selector-options.test.ts src/__tests__/hooks/useModelSelector.test.tsx src/__tests__/services/model-routing.test.ts src/__tests__/services/gemini-chat-routing.test.ts`: 58 pruebas aprobadas antes de añadir la regresión del identificador entrante.
- `npm run test -- src/__tests__/hooks/useModelSelector.test.tsx src/__tests__/services/gemini-chat.test.ts`: 28 pruebas aprobadas, incluida esa regresión y el mensaje público corregido.
- `npm run verify:pr`: aprobado; 3572 pruebas aprobadas y una omitida, 340 archivos aprobados y uno omitido. Duración de Vitest: 108,95 segundos. Adaptadores, arnés, suministro, documentos, semilla, OpenSpec, tipos y lint aprobados.
- Después de los últimos ajustes se repitieron `npm run typecheck`, `npm run lint:changed` (102 archivos sin deuda nueva) y `npm run openspec:validate` (33 cambios aprobados).
- `npm run docs:check`: 337 Markdown activos con enlaces válidos. `npm run docs:system:check`: 28 documentos, 150 IDs, 441 canales y 506 archivos de prueba verificados.
- `git diff --check --cached`: aprobado. Sin archivos pendientes de resolución ni marcadores de conflicto en código y documentación activa.

## Revisión adversarial local y límites

Se comprobaron identidad compartida de selector/cuota, agotamiento de Max,
preferencias anteriores, remontaje, sincronización entre selectores, prioridad
del razonamiento vigente y aislamiento de preferencias por usuario. La revisión
detectó y corrigió los mensajes divergentes y la pérdida de selección desde
`gpt-6-sol`. Las pruebas cubren esos casos; no se realizó revisión independiente.

Se conserva el actuador Computer Use en Gemini. No se comprobaron proveedores
con llamadas reales ni se ejecutó empaquetado. Vitest emite advertencias de
configuración Vite y localStorage; la compuerta terminó con código cero.

## Recuperación

Los dos padres conservan los estados anteriores del merge. Una reversión futura
del commit de merge requiere elegir explícitamente el padre principal; no hay
migraciones de datos ni modificaciones de secretos en esta resolución.
