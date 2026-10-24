## Purpose

Preparar el lector documental con dependencias reproducibles y verificadas, conservando las integraciones y rechazando runtimes PDF conocidos como inseguros antes de interpretar documentos.

## ADDED Requirements

### Requirement: Dependencias del lector reproducibles
La preparación MUST fijar versiones y hashes del cierre del lector y comprobarlos antes de promocionar el runtime. MUST NOT aceptar sdist o artefactos sin correspondencia de hash en ese paso.

#### Scenario: Artefacto o versión incompatible
- **WHEN** falta una wheel admitida, falla el hash, pip check o la versión instalada no coincide con el lock
- **THEN** falla la preparación y se conserva el runtime previo sin promocionar el candidato

### Requirement: Caché de preparación completa
La caché MUST depender también de los bytes del lock transitivo del lector, además de los entrypoints y target del runtime.

#### Scenario: Cambio sólo en el lock
- **WHEN** se actualiza una transitiva o hash sin modificar el entrypoint
- **THEN** la caché anterior no se considera vigente

### Requirement: Rechazo de runtime PDF inseguro
El lector MUST rechazar versiones PDF conocidas como vulnerables o inverificables antes de interpretar el documento. MUST comunicar un error controlado que indique actualizar el runtime, sin nuevas capacidades ni rutas internas públicas.

#### Scenario: Instalación antigua
- **WHEN** la metadata de pdfminer.six es anterior al parche publicado, no está disponible o no se puede verificar
- **THEN** no se invoca el parser PDF y la lectura devuelve dependencia incompatible

### Requirement: Evidencia proporcional
La entrega MUST distinguir resolución, descarga, instalación y ejecución, registrando versiones exactas y alcance de los avisos consultados. MUST preservar API, privacidad, presupuesto y resultados documentales normales.

#### Scenario: Verificación con dependencias fijadas
- **WHEN** se ejecutan pruebas en el entorno temporal preparado
- **THEN** se comprueban las versiones del lock y los casos de lectura/privacidad/errores, sin atribuir ejecución a otras plataformas no probadas
