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
- **THEN** puede cargar las reglas de SofLIA y ejecutar los flujos de propuesta, aplicacion, verificacion y archivo

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
