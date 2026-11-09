## Purpose

Evitar que commits o scripts con incidencias nuevas obtengan un lint incremental
aprobado por usar una referencia incorrecta o por omitir su extensión o ruta.

## ADDED Requirements

### Requirement: Comparación verificable por origen del cambio
La compuerta MUST comparar cambios comprometidos contra el ancestro común de
la base configurada y HEAD, y cambios locales contra HEAD. Cuando corresponden
ambos orígenes, MUST satisfacer ambas comparaciones. Una referencia configurada
inválida o una comparación Git no demostrable MUST fallar explícitamente.

#### Scenario: Incidencia incorporada en un commit
- **WHEN** un PR añade una incidencia inexistente en su base
- **THEN** lint falla aunque el archivo de HEAD coincida con el worktree limpio

#### Scenario: Regresión local después de mejora comprometida
- **WHEN** HEAD redujo incidencias y el worktree vuelve a introducirlas
- **THEN** lint falla contra HEAD aunque no exceda la deuda anterior de la rama base

#### Scenario: Referencia inválida
- **WHEN** la referencia configurada no existe o no tiene ancestro verificable
- **THEN** se devuelve error sin presentar una comparación parcial como éxito

### Requirement: Selección completa y literal de fuentes
La compuerta MUST seleccionar ts/tsx/mts/cts/js/jsx/mjs/cjs comprometidos,
modificados o nuevos, preservando rutas literales con espacios/Unicode. MUST
excluir únicamente rutas ignoradas por la configuración y fuentes eliminadas,
y MUST NOT seguir enlaces de fuentes hacia archivos ajenos.

#### Scenario: Script nuevo con incidencia
- **WHEN** se agrega un script de cualquiera de las extensiones soportadas
- **THEN** se analiza con contexto adecuado y se rechaza la incidencia nueva

#### Scenario: Nombre especial
- **WHEN** el nombre contiene espacios, acentos o caracteres de glob
- **THEN** se analiza ese archivo literal sin omisión por interpretación del nombre

### Requirement: Deuda histórica comparable y errores observables
La compuerta MUST conservar presupuestos por regla y severidad sin aceptar
incrementos. Parser fatal o resultado de análisis ausente MUST fallar incluso
cuando la base también sea inválida. Los contextos Node/browser MUST mantener
las reglas de calidad, sin suprimir incidencias para producir un éxito. La
configuración canónica de raíz MUST regir el comando aunque exista otra anidada.

#### Scenario: Deuda histórica sin aumento
- **WHEN** un archivo conserva o reduce las cantidades históricas de sus reglas
- **THEN** se permite ese cambio si ambas fuentes son analizables

#### Scenario: Parser no válido
- **WHEN** el archivo actual o su base no se puede analizar
- **THEN** la compuerta falla y no trata el error del parser como deuda aceptada

#### Scenario: Configuración anidada que omite reglas
- **WHEN** una carpeta contiene una configuración vacía o que desactiva reglas
- **THEN** el comando usa la configuración canónica y rechaza incidencias nuevas
