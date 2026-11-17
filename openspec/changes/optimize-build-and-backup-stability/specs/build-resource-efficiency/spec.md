## ADDED Requirements

### Requirement: Preparación reutilizable y verificación completa
El sistema SHALL reutilizar dependencias Zoom válidas y cachés TypeScript sin omitir verificaciones de tipos.

#### Scenario: Instalación vigente
- **WHEN** manifiesto, locks y paquetes instalados concuerdan
- **THEN** typecheck no reinstala Zoom

#### Scenario: Instalación incompleta
- **WHEN** falta un paquete o cambia el lock
- **THEN** la preparación ejecuta npm ci y falla si no logra una instalación válida

### Requirement: Respaldos con recursos acotados
El sistema SHALL respetar intervalos mensuales sin desbordar temporizadores y SHALL impedir solapamiento de respaldos programados.

#### Scenario: Intervalo de treinta días
- **WHEN** se inicia un respaldo con intervalo de treinta días
- **THEN** no se ejecuta antes de esa fecha y el timer nunca supera el máximo de Node

#### Scenario: Detención durante un respaldo
- **WHEN** se detiene el servicio mientras hay un respaldo en curso
- **THEN** terminar ese respaldo no reactiva la programación

### Requirement: Carga selectiva
El sistema SHALL cargar ajustes y productividad bajo demanda y limitar Google al catálogo consumido.

#### Scenario: Inicio en chat
- **WHEN** se abre el chat sin entrar a productividad ni ajustes
- **THEN** los módulos diferidos no se solicitan por esos puntos de entrada
