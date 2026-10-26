## ADDED Requirements
### Requirement: Conversaciones del proyecto
La sección MUST mostrar las conversaciones asociadas al proyecto y permitir crear o abrir un chat usando la interfaz principal. MUST conservar los vínculos anteriores y aislar espacios personales por usuario, organización y proyecto cuando no existe federación.
#### Scenario: Volver del chat
- **WHEN** se abre o crea una conversación del proyecto
- **THEN** el chat se muestra dentro de la aplicación y una flecha junto al modelo permite volver al listado del proyecto.
#### Scenario: Respuesta tardía
- **WHEN** cambia el usuario, organización o proyecto antes de terminar una lectura
- **THEN** no se aplica la carpeta ni la conversación al contexto nuevo.
