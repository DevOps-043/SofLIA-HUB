## Purpose

Permitir observar los equipos iniciados por voz desde la Orbe sin mezclar su identidad con otras superficies de SofLIA.

## ADDED Requirements

### Requirement: Actividad autenticada de la Orbe

El sistema SHALL mostrar los especialistas de la Orbe en el monitor existente con etiqueta Orbe y metadatos limitados, conservando las aprobaciones de las operaciones subyacentes.

#### Scenario: Equipo iniciado por voz
- **WHEN** una solicitud autenticada de la Orbe inicia un equipo
- **THEN** se abre el monitor y aparece la actividad con su categoría, roles y estado

#### Scenario: Usuario anterior
- **WHEN** llega actividad de una solicitud cuyo propietario ya no es el usuario activo
- **THEN** se rechaza sin restaurar datos de la sesión anterior

### Requirement: Aislamiento por superficie

El sistema SHALL aceptar publicación exclusivamente de los frames principales actuales del Hub y la Orbe, determinar su origen de forma confiable y aislar sus identificadores.

#### Scenario: Identificadores coincidentes
- **WHEN** Hub y Orbe publican equipos con el mismo identificador
- **THEN** los estados se mantienen separados y cada evento solo actualiza su origen

#### Scenario: Superficie no autorizada
- **WHEN** una ventana ajena, reemplazada, subframe o el monitor intenta publicar
- **THEN** se rechaza la solicitud

#### Scenario: Superficie declarada falsa
- **WHEN** la Orbe declara en su evento otra superficie válida
- **THEN** su actividad se identifica como Orbe a partir del emisor comprobado
