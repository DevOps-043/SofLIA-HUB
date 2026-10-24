## Purpose

Mantener verificaciones reproducibles y una publicación que use los artefactos completos del mismo código verificado.

## ADDED Requirements

### Requirement: Verificación cerrada ante fallos de herramientas
El verificador MUST distinguir deuda histórica de una incapacidad de analizar el código y no aceptar errores fatales como baseline.

#### Scenario: Parser inválido también en HEAD
- **WHEN** el parser falla al analizar el archivo o la línea base
- **THEN** el lint incremental falla e informa el impedimento

### Requirement: Publicación con artefactos canónicos
La publicación SHALL depender de una verificación exitosa del mismo commit y construir todos los runtimes por la cadena canónica de cada plataforma.

#### Scenario: Gate rechazado
- **WHEN** una prueba del gate falla
- **THEN** los builds de publicación no comienzan

#### Scenario: Linux limpio
- **WHEN** se construye Linux desde un checkout limpio
- **THEN** la cadena incluye renderer/main, presentaciones, audiovisual y Zoom antes de empaquetar
