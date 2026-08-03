# Pulse Meeting Context Pack

Paquete reutilizable para Claude Code, Codex o cualquier agente que deba:

1. inferir el tipo de reunión,
2. seleccionar una estrategia contextual,
3. extraer resultados operativos estructurados,
4. proponer tareas, riesgos, follow-ups y destino operativo,
5. respetar gobernanza, approval gates y trazabilidad.

## Archivos incluidos

- `AGENTS.md`  
  Instrucción maestra para el agente.
- `meeting_type_registry.yaml`  
  Taxonomía derivada del PRD + Lucid Meetings.
- `extraction_rules.yaml`  
  Reglas de extracción, scoring, gobernanza y priorización.
- `output_schema.json`  
  Contrato de salida estructurada.
- `prompt_master.md`  
  Prompt listo para Claude/Codex referenciando los archivos del paquete.
- `source_traceability.md`  
  Mapa humano de qué fuentes sustentan cada tipo de reunión.
- `implementation_notes.md`  
  Notas prácticas para integrarlo en Pulse.
- `manifest.txt`  
  Lista simple de archivos del paquete.

## Uso recomendado

### Opción A — Claude Code / Codex con repo

1. Copia esta carpeta al repositorio.
2. Deja `AGENTS.md` en la raíz del repo si quieres que el agente lo use siempre.
3. Conserva el resto en `context/meetings/` o una ruta similar.
4. Invoca al agente con el contenido de `prompt_master.md`.

### Opción B — Adjuntar archivos en una sesión

Adjunta:

- `AGENTS.md`
- `meeting_type_registry.yaml`
- `extraction_rules.yaml`
- `output_schema.json`
- `prompt_master.md`

Luego pega el texto de `prompt_master.md`.

## Intención de diseño

Este paquete no trata la transcripción como fin.
La trata como insumo para convertir la reunión en un resultado operativo útil.

---

Quiero que trabajes en dos fases: primero carga contexto desde archivos, luego ejecuta el prompt maestro usando ese contexto.

# FASE 1 — Carga obligatoria de contexto

Antes de responder, lee completa y cuidadosamente estos archivos, en este orden:

1. `AGENTS.md`
2. `meeting_type_registry.yaml`
3. `extraction_rules.yaml`
4. `output_schema.json`
5. `prompt_master.md`

Si existen también estos archivos, léelos como apoyo secundario:

- `source_traceability.md`
- `implementation_notes.md`
- `README.md`
- `manifest.txt`

## Objetivo de esta fase

Debes internalizar y conservar como contexto activo, al menos, lo siguiente:

- reglas operativas y de comportamiento definidas en `AGENTS.md`
- taxonomía de tipos de reunión definida en `meeting_type_registry.yaml`
- reglas de extracción, priorización, gobernanza, validación y routing de `extraction_rules.yaml`
- estructura exacta de salida esperada en `output_schema.json`
- instrucciones maestras, arquitectura y criterios de implementación definidos en `prompt_master.md`

## Reglas duras durante la carga de contexto

- No ignores ningún archivo obligatorio.
- No empieces a diseñar ni a implementar antes de leerlos todos.
- No trates `prompt_master.md` como contexto opcional: debes ejecutarlo después de cargar los demás archivos.
- No inventes tipos de reunión, campos JSON o reglas fuera de esos archivos, salvo que el `prompt_master.md` lo pida explícitamente como extensión controlada.
- Si detectas conflicto entre archivos, usa esta precedencia:
  1. `AGENTS.md`
  2. `prompt_master.md`
  3. `output_schema.json`
  4. `extraction_rules.yaml`
  5. `meeting_type_registry.yaml`
  6. archivos secundarios
- Si algún archivo no existe o no es accesible, dilo explícitamente y continúa con los archivos disponibles, indicando el impacto de esa ausencia.
- No respondas con un resumen largo de los archivos.
- Solo confirma brevemente que el contexto fue cargado y luego pasa a la siguiente fase.

# FASE 2 — Ejecución del prompt maestro

Una vez cargado el contexto, ejecuta íntegramente las instrucciones de `prompt_master.md`.

Eso implica que debes:

- usar la taxonomía de reuniones para inferir el tipo de reunión
- seleccionar o construir la estrategia contextual adecuada
- respetar las reglas de extracción y gobernanza
- producir una salida estructurada alineada con `output_schema.json`
- evitar actuar como un resumidor genérico
- priorizar utilidad operativa, decisiones, tareas, riesgos, follow-ups y continuidad
- mantener explicabilidad, scoring de confianza y revisión humana cuando aplique

## Regla de salida

- Si todavía no te he dado la reunión o el input a procesar, entonces:
  - responde únicamente con una confirmación breve de que ya cargaste el contexto y estás listo para ejecutar el flujo del prompt maestro.
- Si ya te di datos de la reunión, entonces:
  - procesa inmediatamente la entrada usando el contexto cargado y las reglas del `prompt_master.md`.

## Formato de confirmación si aún no hay input

Usa algo así, de forma breve:

- `Contexto cargado desde archivos. Listo para ejecutar el prompt maestro con la entrada de reunión.`

No agregues relleno.
Empieza ahora.
