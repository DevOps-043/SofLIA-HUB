## Purpose

Ejecutar las primitivas GUI existentes con datos separados de código y una
operación vigente durante procesos, capturas y reconocimiento de texto.

## ADDED Requirements

### Requirement: Datos literales y contratos cerrados

El sistema SHALL transportar texto/coordenadas como datos sin shell ni código
del usuario; validar acción, valores finitos y combinaciones de teclas.

#### Scenario: Texto hostil o tecla malformada
- **WHEN** el texto incluye comillas, sustituciones o símbolos de SendKeys
- **THEN** sigue siendo texto; una combinación inválida se rechaza antes de proceso

### Requirement: Procesos acotados y cancelación

El sistema SHALL limitar duración/salida del hijo y retener ejecución hasta
su cierre físico tras timeout, error o revocación.

#### Scenario: Hijo lento o salida excesiva
- **WHEN** el hijo excede límites o se aborta la operación
- **THEN** se solicita terminarlo, no se publica éxito y no se inicia otra etapa

### Requirement: OCR vigente y limpieza

El sistema SHALL reconocer la estructura Tesseract 7 y terminar el worker
admitido incluso ante errores, preservando la revisión de sesión y origen.

#### Scenario: Revocación durante reconocimiento
- **WHEN** cambia sesión/navegación mientras se obtiene el resultado OCR
- **THEN** no hay nuevo intento de idioma, acción ni captura de depuración posterior

### Requirement: Funciones GUI conservadas

El sistema SHALL conservar movimiento, clicks, drag, escritura y key, con
backends Windows/macOS/Linux explícitos y sin modificar permisos de entrada.

#### Scenario: Operación válida a través de IPC
- **WHEN** una fuente aprobada solicita una primitiva válida
- **THEN** el servicio conserva las capas existentes y entrega la orden acotada al SO
