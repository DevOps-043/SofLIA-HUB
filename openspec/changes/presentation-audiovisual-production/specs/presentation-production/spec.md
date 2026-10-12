## ADDED Requirements

### Requirement: Formatos consistentes
El sistema MUST entregar un PPTX editable al solicitar PPTX y un HTML autocontenido al exportar deck.json a HTML.

#### Scenario: Solicitud PPTX desde mensajería
- **WHEN** create_document recibe type pptx
- **THEN** entrega un archivo .pptx binario real con contenido editable

### Requirement: Producción audiovisual verificable
El sistema MUST producir MP4 solamente desde un film.json validado en el workspace audiovisual y comprobar sus fotogramas, cadencia, duración y audio.

#### Scenario: Manifiesto editado después del render
- **WHEN** cambia film.json tras una producción exitosa
- **THEN** el estado ready se vuelve falso hasta producir y verificar esa revisión

#### Scenario: Cancelación
- **WHEN** el usuario cancela una producción activa
- **THEN** finaliza el proceso de medios y elimina sus temporales sin declarar éxito
