## ADDED Requirements

### Requirement: Catalogo integral por dominio

El repositorio SHALL documentar producto, actores, reglas de negocio, requisitos
funcionales/no funcionales, historias, UX/UI, frontend, backend, IPC, agentes,
integraciones, datos, seguridad, DevOps, calidad, operacion, limites y decisiones.

#### Scenario: Un rol busca su fuente de verdad
- **WHEN** abre `docs/README.md`
- **THEN** puede navegar al documento vigente de su dominio sin usar material archivado

### Requirement: Afirmaciones trazables

Los catalogos normativos MUST enlazar archivos versionados que demuestren el
comportamiento descrito y SHALL marcar razones como confirmadas, inferidas o no
documentadas.

#### Scenario: Se registra una decision historica sin ADR
- **WHEN** el codigo solo permite inferir su motivo
- **THEN** el documento la etiqueta como inferida y enlaza la evidencia sin presentarla como hecho historico

### Requirement: Requisitos identificables y verificables

Reglas, requisitos e historias SHALL usar identificadores estables y la matriz
SHALL relacionarlos con componentes, datos y pruebas o brechas conocidas.

#### Scenario: Se modifica una capacidad
- **WHEN** un PR cambia su comportamiento observable
- **THEN** el revisor puede localizar requisitos, reglas, historias y evidencia afectada por identificador

### Requirement: Cobertura documental automatizada

La compuerta de PR SHALL comprobar documentos obligatorios, IDs unicos, marcadores
pendientes y existencia de rutas de evidencia declaradas.

#### Scenario: Se borra un documento o evidencia obligatoria
- **WHEN** se ejecuta `npm run docs:system:check`
- **THEN** la validacion falla e identifica el documento o ruta faltante

### Requirement: Documentacion no expone secretos

La documentacion MUST listar nombres, procedencia y consumidor de configuraciones,
pero MUST NOT contener valores de `.env`, tokens, claves ni credenciales.

#### Scenario: Se documenta una integracion
- **WHEN** requiere una variable sensible
- **THEN** solo se registra su nombre, obligatoriedad, proceso consumidor y manejo seguro
