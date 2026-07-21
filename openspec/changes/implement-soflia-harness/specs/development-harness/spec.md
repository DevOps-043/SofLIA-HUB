## ADDED Requirements

### Requirement: Contexto canónico para agentes
El repositorio SHALL mantener una única fuente canónica de normas, roles y skills,
con adaptadores delgados por herramienta que apunten a dicha fuente.

#### Scenario: Un agente inicia una tarea
- **WHEN** un agente compatible abre el repositorio
- **THEN** encuentra el router raíz, las normas del área y la skill pertinente sin depender de una copia divergente

### Requirement: Ciclo de cambio spec-driven
Todo cambio material SHALL registrar motivación, requisitos observables, decisiones,
tareas y evidencia mediante un cambio OpenSpec antes de declararse terminado.

#### Scenario: Se solicita una capacidad nueva
- **WHEN** la solicitud afecta varios módulos, contratos o permisos
- **THEN** existe un cambio OpenSpec válido y listo para aplicar antes de cerrar la implementación

### Requirement: Aislamiento recuperable
El arnés SHALL preservar trabajo ajeno y aislar cambios materiales mediante una
rama o worktree recuperable.

#### Scenario: El worktree contiene trabajo guardado
- **WHEN** comienza una implementación nueva
- **THEN** el agente verifica el estado Git y trabaja en una rama dedicada sin borrar ni reescribir cambios previos

### Requirement: Compuertas progresivas
El repositorio SHALL ofrecer validación de estructura, documentación, tipos, lint
incremental y pruebas, además de una compuerta de release más costosa.

#### Scenario: Se prepara un pull request
- **WHEN** termina la implementación
- **THEN** la compuerta de PR comprueba el estado actual y distingue regresiones de deuda histórica documentada

#### Scenario: Se prepara un release
- **WHEN** el cambio es candidato a distribución
- **THEN** la compuerta de release restaura dependencias nativas para Electron y compila el artefacto de aplicación

### Requirement: Evidencia y revisión adversarial
Cada cambio SHALL conservar comandos ejecutados, resultados, casos negativos,
fallos preexistentes y riesgo residual.

#### Scenario: Una prueba falla
- **WHEN** la verificación encuentra un fallo
- **THEN** el reporte identifica si fue introducido por el cambio o ya estaba en la línea base, sin afirmar una compuerta no ejecutada

### Requirement: Higiene del repositorio
El arnés SHALL rechazar configuraciones locales, cachés, binarios generados y copias
de código documental que pertenezcan fuera del control de versiones.

#### Scenario: Aparece un artefacto prohibido
- **WHEN** un archivo prohibido está versionado
- **THEN** `harness:validate` falla e identifica la ruta exacta
