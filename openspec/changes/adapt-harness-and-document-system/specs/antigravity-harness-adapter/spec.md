## ADDED Requirements

### Requirement: Antigravity consume la fuente canonica

El repositorio SHALL exponer skills de desarrollo a Antigravity desde
`.agents/skills/` mediante adaptadores generados que apunten a `ai-specs/skills/`.

#### Scenario: Se agrega o cambia una skill canonica
- **WHEN** se ejecuta `npm run adapters:sync`
- **THEN** Codex, Claude y Antigravity reciben wrappers equivalentes sin copiar la logica de la skill

#### Scenario: Un adaptador queda desactualizado
- **WHEN** se ejecuta `npm run adapters:check`
- **THEN** la compuerta falla e identifica el wrapper divergente o ausente

### Requirement: Antigravity ofrece regla y workflows de workspace

El repositorio SHALL mantener una regla de workspace y workflows OpenSpec en las
rutas `.agents/rules/` y `.agents/workflows/`, cada archivo dentro del limite de
12,000 caracteres.

#### Scenario: Un agente Antigravity abre el workspace
- **WHEN** descubre las customizaciones del proyecto
- **THEN** puede cargar las reglas de Pulse y ejecutar los flujos de propuesta, aplicacion, verificacion y archivo

### Requirement: Superficies retiradas no reaparecen

El arnes MUST NOT versionar `.cursor/`, `.gemini/` ni `GEMINI.md`.

#### Scenario: Se regenera un adaptador retirado
- **WHEN** una de esas rutas aparece en archivos versionados
- **THEN** `harness:validate` falla con la ruta prohibida

### Requirement: Proveedor runtime y herramienta de desarrollo se distinguen

La documentacion MUST distinguir Gemini API/modelos usados dentro del producto de
Gemini CLI como adaptador de desarrollo retirado.

#### Scenario: Se consulta el stack de IA
- **WHEN** un mantenedor revisa la documentacion
- **THEN** encuentra que Antigravity es la superficie de desarrollo y Gemini continua siendo una dependencia runtime hasta una migracion especifica

### Requirement: Buenas practicas de ingenieria siempre disponibles

El arnes SHALL mantener las reglas detalladas de ingenieria en una fuente
canonica, SHALL cargarla desde el router general y la regla Antigravity, y SHALL
conservar `docs/prompt_maestro.md` como alias de compatibilidad.

#### Scenario: El usuario invoca el prompt maestro
- **WHEN** referencia `@docs/prompt_maestro.md` en Antigravity
- **THEN** el agente recibe la instruccion de cargar el estandar canonico completo

#### Scenario: Un agente inicia una tarea sin invocacion manual
- **WHEN** sigue `AGENTS.md` o `.agents/rules/soflia-harness.md`
- **THEN** carga las buenas practicas antes de seleccionar la guia del area

#### Scenario: Se elimina o desconecta el estandar
- **WHEN** se ejecuta `npm run harness:validate`
- **THEN** la validacion falla e identifica la ruta o enlace obligatorio ausente
