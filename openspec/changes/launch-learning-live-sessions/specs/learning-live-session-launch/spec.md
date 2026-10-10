# Apertura de sesiones académicas

## ADDED Requirements

### Requirement RF LLS 01 Referencia de sesión
Hub SHALL aceptar únicamente un slug de organización válido y un UUID de sesión en el protocolo de Learning.

#### Scenario Enlace sin credenciales
- WHEN se recibe un enlace válido
- THEN el Hub conserva la referencia sin aceptar URLs, tokens ni roles incluidos por terceros

### Requirement RF LLS 02 Acceso autenticado
Hub SHALL consultar Learning con la sesión SOFIA del proceso main y SHALL abrir solo una URL Zoom autorizada.

#### Scenario Usuario sin sesión
- WHEN se recibe una sesión académica sin identidad autenticada
- THEN la referencia se conserva mientras el usuario inicia sesión

#### Scenario Acceso rechazado
- WHEN Learning rechaza organización, curso, usuario o estado
- THEN no se abre una reunión y se presenta un error recuperable

### Requirement RF LLS 03 Compatibilidad
Hub SHALL conservar los protocolos de share, autenticación y monitoreo existentes.

#### Scenario Arranque y repetición
- WHEN el enlace se recibe en arranque frío o aplicación abierta
- THEN se procesa la misma referencia una sola vez por solicitud activa
