## ADDED Requirements

### Requirement: Identidad pública unificada
La aplicación SHALL mostrar Soflia Hub en sus superficies públicas y utilizar el
logo transparente proporcionado sin deformarlo.

#### Scenario: Acceso y navegación
- **WHEN** el usuario abre inicio de sesión, barra lateral, inicio del navegador o bandeja
- **THEN** se muestra el nuevo logo y el nombre Soflia Hub donde existe una etiqueta de marca

#### Scenario: Distribución
- **WHEN** se generan los instaladores
- **THEN** iconos, nombres públicos, accesos directos y artefactos usan la marca Soflia Hub
- **AND** los iconos de plataforma son cuadrados y conservan transparencia

### Requirement: Compatibilidad del perfil y contratos
El cambio de marca SHALL conservar el perfil de datos y sesiones, el contexto de
cifrado, la identidad de actualización y los contratos externos existentes.

#### Scenario: Inicio tras actualizar
- **WHEN** se inicia la versión empaquetada con la nueva marca
- **THEN** userData y sessionData apuntan al perfil anterior antes de crear sesiones
- **AND** no se copian ni eliminan datos del usuario

#### Scenario: Desarrollo
- **WHEN** se inicia la aplicación sin empaquetar
- **THEN** se conserva el perfil de desarrollo detectado antes de setName

#### Scenario: Actualización desde el shell
- **WHEN** se selecciona una instalación anterior reconocida
- **THEN** el shell acepta el destino y comprueba que los procesos anterior y nuevo están cerrados
