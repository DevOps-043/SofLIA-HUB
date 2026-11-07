## Purpose

Impedir entregas sin cobertura de producción comprobable o con dependencias mutables en workflows, manteniendo una sola ejecución integral de pruebas por compuerta.

## ADDED Requirements

### Requirement: Cobertura global efectiva
La compuerta MUST medir líneas, sentencias, funciones y ramas de toda producción TS/TSX de src/electron, incluidos archivos no importados. Sólo MUST excluir pruebas y declaraciones. MUST fallar con reporte ausente, inválido o por debajo de los pisos versionados, fijados a partir de una medición real. No MUST sustituir cobertura por cantidad de tests ni ejecutar dos veces la misma suite.

#### Scenario: Archivos sin importar
- **WHEN** un módulo productivo no se ejecuta en la suite
- **THEN** su falta de cobertura cuenta en el resultado global

#### Scenario: Regresión o ausencia
- **WHEN** baja la cobertura bajo un piso o falta un resultado válido
- **THEN** falla la compuerta sin omitir controles anteriores

### Requirement: Dependencias inmutables de workflows
La compuerta MUST rechazar referencias remotas a Actions/workflows que no fijen SHA completo, referencias dinámicas y referencias docker:// en uses sin digest. Las referencias locales MUST permanecer relativas dentro del repositorio. No MUST ampliar permisos o acceso a secretos para lograrlo.

#### Scenario: Tag o rama mutable
- **WHEN** un paso o job usa una Action remota con tag, rama o expresión
- **THEN** falla la política antes de ejecutar pruebas/publicación

#### Scenario: Dependencia fija y origen conocido
- **WHEN** todos los usos remotos fijan commits completos y los locales no escapan del repositorio
- **THEN** la política aprueba sin ejecutar Actions remotas
