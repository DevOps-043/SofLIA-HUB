# Handoff para Claude - Meeting Context Pack / Prompt Master

## Como usar este handoff

1. Primero pega en Claude el prompt inicial que le exige cargar contexto desde archivos.
2. Deja que lea, en este orden:
   - `AGENTS.md`
   - `Context Pack/meeting_type_registry.yaml`
   - `Context Pack/extraction_rules.yaml`
   - `Context Pack/output_schema.json`
   - `Context Pack/prompt_master.md`
3. Despues haz que lea este archivo para retomar exactamente desde el estado actual del codigo.

## Objetivo del trabajo ya iniciado

Se empezo a alinear el flujo de Meeting Ops existente con el `Context Pack`, para que la extraccion de reuniones deje de ser un resumen generico y pase a producir una salida estructurada segun `output_schema.json`, usando la taxonomia de `meeting_type_registry.yaml` y las reglas de `extraction_rules.yaml` / `prompt_master.md`.

## Estado actual

- El trabajo esta avanzado pero no cerrado.
- Ya existe una primera implementacion funcional del loader del Context Pack y del nuevo extractor.
- El proyecto casi compila.
- Ultima verificacion ejecutada:
  - `node_modules\.bin\tsc.cmd --noEmit`
  - resultado: solo 3 errores TypeScript, todos en `electron/meetings/meeting-ai-service.ts`

## Errores actuales de compilacion

`tsc --noEmit` reporta:

- `electron/meetings/meeting-ai-service.ts(421,21): error TS18047: 'fallbackDefinition' is possibly 'null'.`
- `electron/meetings/meeting-ai-service.ts(422,23): error TS18047: 'fallbackDefinition' is possibly 'null'.`
- `electron/meetings/meeting-ai-service.ts(424,26): error TS18047: 'fallbackDefinition' is possibly 'null'.`

Zona exacta:

- archivo: `electron/meetings/meeting-ai-service.ts`
- bloque: metodo `classifyMeeting(...)`
- problema: en el branch fallback ya se comprueba `!fallbackDefinition`, pero luego se siguen leyendo `fallbackDefinition.extractionFocus` y `fallbackDefinition.displayName`.

## Riesgo logico ya detectado

Aunque no rompe compilacion, hay un detalle sospechoso en:

- `electron/meetings/meeting-ai-service.ts`
- metodo `stripLabel(...)`

Ahora mismo contiene dos `.replace(...)` seguidos, uno con regex acentuada y otro con unicode escapes:

- linea aproximada 1042
- linea aproximada 1043

Eso parece residuo de una correccion a medias. Compila, pero conviene dejar un solo `replace(...)` limpio.

## Archivos ya tocados

### 1. `electron/meetings/meeting-types.ts`

Se agregaron tipos nuevos alineados al schema del Context Pack:

- `MeetingAnalysisResult`
- tipos anidados para clasificacion, estrategia, tareas, riesgos, follow-up, routing, governance, drafts, etc.
- `analysis_result?: MeetingAnalysisResult | null` dentro de `MeetingAssetPayload`

### 2. `electron/meetings/meeting-context-pack.ts`

Archivo nuevo.

Implementa:

- carga de `AGENTS.md` raiz y `Context Pack/AGENTS.md`
- carga de:
  - `meeting_type_registry.yaml`
  - `extraction_rules.yaml`
  - `output_schema.json`
  - `prompt_master.md`
- lectura opcional de:
  - `source_traceability.md`
  - `implementation_notes.md`
  - `README.md`
  - `manifest.txt`
- parseo basico de `meeting_type_registry.yaml` a `MeetingTypeDefinition[]`
- extraccion de umbrales de confianza desde `extraction_rules.yaml`
- cache del pack cargado

Nota:

- `readFiles(...)` ya fue corregido para devolver `LoadedContextPackFiles`.

### 3. `electron/meetings/meeting-ai-service.ts`

Fue reemplazado el extractor viejo por uno nuevo.

Ahora hace:

- carga el Context Pack via `MeetingContextPackLoader`
- construye prompt usando:
  - `Context Pack/AGENTS.md`
  - `prompt_master.md`
  - `extraction_rules.yaml`
  - `output_schema.json`
  - taxonomia compacta de reuniones
- intenta extraccion con Gemini en JSON
- normaliza salida a `MeetingAnalysisResult`
- aplica fallback heuristico si la IA falla
- convierte el resultado nuevo al payload legado del workflow existente:
  - `decisions`
  - `commitments`
  - `issues`
  - `open_questions`
  - `parking_lot`
  - `continuity_context`
  - `proposed_actions`
  - `analysis_result`

Tambien hace clasificacion inicial del tipo de reunion y routing sugerido.

Pendiente aqui:

- corregir el branch fallback de `classifyMeeting(...)`
- limpiar `stripLabel(...)`
- revisar que el payload final respete completamente el `output_schema.json`
- validar que no haya inconsistencias semanticas entre `analysis_result` y los campos legados

### 4. `electron/meetings/meeting-review-service.ts`

Se ajusto la generacion de acciones para leer `analysis_result.destinationRecommendation`.

Cambios principales:

- solo crea sync drafts si el destino sugerido es:
  - `IRIS`
  - `Project Hub`
  - `Project`
- sube el umbral minimo de confianza cuando la clasificacion viene con confianza media-baja
- incorpora `analysis_result.tasks[index].reason` al description de la accion
- relaja banderas de bloqueo:
  - `missing_project_target` solo si faltan ambos `team_id` y `project_id`
  - `missing_owner` solo si faltan ambos `assignee_id` y `owner_candidate`
- solo exige `missing_project_target` cuando el routing realmente implica sincronizacion operativa

### 5. `electron/meetings/meeting-store.ts`

Se agrego:

- `updateRunClassification(runId, { meetingTitle?, meetingType? })`

Esto actualiza:

- `meeting_runs.meeting_title`
- `meeting_runs.meeting_type`
- `updated_at`

### 6. `electron/meetings/meeting-workflow-service.ts`

Despues de extraer y enriquecer el asset:

- actualiza la clasificacion persistida del run con:
  - titulo final
  - `analysis_result.meetingType.suggestedType` como meeting type principal

### 7. `src/services/meeting-service.ts`

Se agrego el tipo frontend `MeetingAnalysisResult` y se extendio:

- `detail.latest_asset.payload.analysis_result`

para que el renderer pueda consumir la nueva estructura.

### 8. `src/components/meetings/MeetingOpsPanel.tsx`

Se agrego lectura de:

- `const currentAnalysis = detail?.latest_asset?.payload.analysis_result || null;`

Y se empezo a mostrar:

- clasificacion de reunion
- routing/follow-up
- governance
- tareas desde `analysis_result.tasks`
- riesgos y preguntas abiertas

La UI no esta revisada a fondo despues del cambio; falta comprobar render y tipos.

## Archivos del repo actualmente modificados

Segun `git status --short`:

- `electron/meetings/meeting-ai-service.ts`
- `electron/meetings/meeting-review-service.ts`
- `electron/meetings/meeting-store.ts`
- `electron/meetings/meeting-types.ts`
- `electron/meetings/meeting-workflow-service.ts`
- `src/components/meetings/MeetingOpsPanel.tsx`
- `src/services/meeting-service.ts`
- `electron/meetings/meeting-context-pack.ts` (nuevo)

Tambien aparecen agregados los archivos del `Context Pack`.

## Siguiente paso recomendado para Claude

1. Leer primero el Context Pack segun el prompt inicial.
2. Leer este handoff.
3. Abrir `electron/meetings/meeting-ai-service.ts`.
4. Corregir el fallback de `classifyMeeting(...)`.
5. Limpiar `stripLabel(...)`.
6. Ejecutar `node_modules\.bin\tsc.cmd --noEmit`.
7. Corregir cualquier error restante.
8. Revisar que `MeetingOpsPanel.tsx` realmente renderice bien la nueva semantica.
9. Validar el flujo completo:
   - crear run manual
   - extraer asset
   - revisar flags
   - aprobar acciones
   - sincronizar

## Checklist concreto de cierre

- [ ] `meeting-ai-service.ts` compila sin errores
- [ ] `stripLabel(...)` queda limpio y determinista
- [ ] la salida nueva respeta el schema y no inventa datos
- [ ] `analysis_result` queda persistido y visible en UI
- [ ] las acciones propuestas respetan routing y governance
- [ ] `MeetingOpsPanel` no rompe types ni render
- [ ] `tsc --noEmit` queda en verde

## Comando de verificacion usado

```powershell
node_modules\.bin\tsc.cmd --noEmit
```

## Nota final para Claude

No hace falta reempezar desde cero. La integracion grande ya esta avanzada. El punto de continuidad real esta en `electron/meetings/meeting-ai-service.ts`: cerrar nulabilidad del fallback, limpiar `stripLabel`, volver a compilar y luego hacer una pasada final de consistencia funcional sobre review/workflow/UI.
