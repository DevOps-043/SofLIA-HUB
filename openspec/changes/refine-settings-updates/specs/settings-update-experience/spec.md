## ADDED Requirements
### Requirement: Versiones derivadas
El panel SHALL obtener la versión de la aplicación y el historial del CHANGELOG canónico, sin un catálogo de versiones mantenido en componentes.
#### Scenario: Nueva compilación
- **WHEN** cambia package.json y se añade una entrada en CHANGELOG.md
- **THEN** el panel muestra esa versión y sus notas sin cambiar React
#### Scenario: Notas entrantes
- **WHEN** el actualizador informa otra versión con notas
- **THEN** se integra una sola entrada de esa versión, preservando el historial instalado
### Requirement: Estado verificable
La interfaz SHALL distinguir no comprobado de al día y mostrar fallos de consulta, descarga e instalación.
#### Scenario: Servicio sin consultar
- **WHEN** el actualizador está idle o no disponible
- **THEN** no afirma que la versión instalada sea la última
### Requirement: Iconografía y movimiento accesible
Menú, ajustes y navegador SHALL compartir iconos de Proyectos con respuesta hover, foco y pulsación, respetando movimiento reducido y disabled.
#### Scenario: Movimiento reducido
- **WHEN** el sistema solicita reduced-motion
- **THEN** los controles funcionan sin transformaciones ni animaciones de entrada
