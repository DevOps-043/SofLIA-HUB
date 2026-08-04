## ADDED Requirements

### Requirement: Workspace colaborativo de navegador
El sistema SHALL presentar el navegador integrado como panel derecho y SHALL mantener una única instancia del chat activo en la región izquierda mientras el modo navegador esté abierto.

#### Scenario: Apertura manual
- **WHEN** el usuario pulsa Navegador desde la Sidebar
- **THEN** la Sidebar de navegación se sustituye por el chat activo, el navegador aparece a la derecha y no se pierde la conversación

#### Scenario: Apertura solicitada por el agente
- **WHEN** Computer Use solicita abrir el navegador mientras está cerrado
- **THEN** el sistema activa el mismo workspace colaborativo y espera un viewport visible antes de capturar

#### Scenario: Cierre y restauración
- **WHEN** el usuario cierra el panel del navegador
- **THEN** el sistema restaura la Sidebar, chats y carpetas en su estado anterior y conserva la página web

### Requirement: Panel redimensionable y persistente
El sistema SHALL permitir ajustar el ancho del navegador entre un mínimo utilizable y el ancho total disponible, y SHALL conservar la preferencia local válida.

#### Scenario: Ajuste intermedio
- **WHEN** el usuario arrastra el divisor dentro de los límites
- **THEN** navegador y chat cambian de ancho en tiempo real y la vista nativa recibe bounds actualizados

#### Scenario: Expansión completa
- **WHEN** el usuario expande el navegador al ancho máximo
- **THEN** el navegador cubre el chat sin cubrir controles externos a su viewport reservado

#### Scenario: Preferencia corrupta
- **WHEN** el ancho guardado no es numérico o queda fuera de la ventana actual
- **THEN** el sistema usa un valor predeterminado acotado sin desbordar la UI

