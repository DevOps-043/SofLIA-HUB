## ADDED Requirements
### Requirement: Agente exclusivamente lateral en el navegador
El navegador MUST mostrar el agente en su panel lateral ajustable y minimizable. MUST NOT montar el lanzador de chat de proyectos ni reservar una franja inferior para el compositor. El compositor flotante MUST limitarse a las secciones de proyectos que no muestran su chat.
#### Scenario: Abrir, minimizar y reabrir el agente
- **WHEN** se abre el navegador y se minimiza y reabre su chat
- **THEN** sólo cambia el espacio lateral reservado y no aparece un compositor inferior.
#### Scenario: Selección de una página
- **WHEN** llega una selección externa con el lateral minimizado
- **THEN** el lateral se reabre y conserva la conversación del ámbito actual.
#### Scenario: Proyecto sin navegador
- **WHEN** se muestra una sección de proyecto distinta de su chat
- **THEN** se conserva el acceso al compositor flotante del proyecto.
