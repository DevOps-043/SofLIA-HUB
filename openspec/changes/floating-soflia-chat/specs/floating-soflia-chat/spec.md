## ADDED Requirements
### Requirement: Chat compacto dentro de la aplicación
Soflia MUST mostrar un botón con su icono oficial, sin avatar, en las secciones que no muestran el chat principal. MUST abrir un panel dentro de la ventana con compositor y respuestas del chat existente. Minimizar MUST conservar el borrador y la generación, y Stop MUST conservar su cancelación.
#### Scenario: Abrir y conversar
- **WHEN** el usuario pulsa el icono, escribe y envía
- **THEN** la respuesta se muestra progresivamente en el mismo panel sin cambiar de vista.
### Requirement: Contexto y acciones verificables
El panel MUST leer contexto automáticamente al enviar, sin una franja de controles de contexto, y MUST tratar el contenido como datos no confiables. Campos editables, secretos y el propio panel MUST quedar excluidos del contexto renderer. Una pestaña o ámbito cambiado MUST invalidar la preparación. Las acciones MUST usar herramientas y guardas existentes y conservar HITL sensible.
#### Scenario: Referencia a la vista
- **WHEN** el usuario pregunta por lo que está viendo
- **THEN** el turno recibe contexto de la superficie visible o un error verificable, sin fingir haber leído.
### Requirement: Ámbito y compositor nativo
MUST impedir respuestas y acciones tardías en otra identidad, organización, proyecto o conversación. El navegador MUST reservar espacio para los controles y mantener la página operable sin tapar el panel ni crear otra ventana.
#### Scenario: Cambio de proyecto
- **WHEN** cambia el proyecto durante una preparación o generación
- **THEN** se cancela el turno anterior y no se escribe en el nuevo destino.
### Requirement: Conversación nueva y presentación compacta
El panel MUST mostrar Nuevo chat en su cabecera en todas las secciones editables. MUST iniciar una conversación vacía en el ámbito actual sin abandonar la vista y sin conservar el borrador anterior. El menú de modelos MUST permanecer dentro del panel sin desplazar ni recortar el historial y el compositor MUST permanecer accesible.
#### Scenario: Nuevo chat desde tareas
- **WHEN** el usuario pulsa Nuevo chat en el panel flotante de tareas
- **THEN** se vacía el compositor y la conversación conservando el tablero y el ámbito del proyecto.

### Requirement: Barra delgada y desplazable
El panel MUST tener una cabecera compacta sin marca ni título visible, con botón + de nuevo chat y selector de modelos accesibles. MUST permitir moverlo mediante el asa con puntero o flechas dentro de la superficie de la aplicación y ajustar su posición al cambiar de tamaño.
#### Scenario: Arrastrar y minimizar
- **WHEN** el usuario arrastra el panel y lo minimiza/reabre
- **THEN** se conserva su posición y borrador sin quedar fuera del área visible.
#### Scenario: Apertura en reposo
- **WHEN** se abre mediante ratón sin escribir
- **THEN** no se enfoca el campo automáticamente ni se presenta un resaltado de escritura; sin conversación seleccionada se ofrece una entrada compacta que prepara un chat autorizado.
#### Scenario: Mover sobre una página nativa
- **WHEN** se mueve el panel sobre el navegador integrado
- **THEN** el navegador conserva una región operable que no cubre el chat y recupera su composición al terminar o cancelar el arrastre.
