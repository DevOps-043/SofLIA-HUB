# Implementation Notes

## Recomendación para SofLIA
Usa este paquete en tres capas:

### 1. Context pack persistente
Archivos del paquete:
- `AGENTS.md`
- `meeting_type_registry.yaml`
- `extraction_rules.yaml`
- `output_schema.json`

### 2. Prompt de ejecución
Usa el contenido de `prompt_master.md`.

### 3. Input dinámico por reunión
Inyecta:
- metadatos de reunión,
- project context,
- added sources relevantes,
- transcripción limpia.

## Integración sugerida
### Claude Code
- Coloca `AGENTS.md` en la raíz.
- Deja los YAML/JSON en una carpeta como `context/meetings/`.
- En la instrucción de la tarea, pide explícitamente leer esos archivos antes de actuar.

### Codex
- Mantén `AGENTS.md` y los archivos del paquete dentro del repo.
- En la tarea, referencia la ruta exacta de los archivos.
- Pide salida estrictamente JSON con base en `output_schema.json`.

## Patrón recomendado
1. Detector contextual
2. Clasificador de meeting type
3. Strategy selector
4. Extractor estructurado
5. Recommendation engine
6. Human review gate

## Qué no hacer
- No pasar todos los PDFs de Lucid en cada ejecución.
- No pegar todo el PRD completo dentro del prompt.
- No dejar al modelo decidir libremente la forma de salida.
- No mezclar recomendaciones con acciones ya aprobadas.
