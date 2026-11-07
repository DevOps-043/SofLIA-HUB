## Purpose

Permitir revisar y decidir una acción del chat por teclado dentro de una
confirmación modal real, conservando la identidad y autoridad de la solicitud.

## ADDED Requirements

### Requirement: Modalidad y foco de revisión
Abrir una confirmación MUST llevar el foco a Cancelar o al título si el contenido
requiere desplazamiento para ser leído. Tab/Shift+Tab MUST mantener el recorrido
dentro del diálogo. El fondo MUST quedar inerte mientras siga abierto. Cerrar
MUST devolver el foco al invocador si sigue disponible. Nombre/título MUST tener
asociación única por instancia.

#### Scenario: Confirmación corta por teclado
- **WHEN** se abre una confirmación desde un control enfocado
- **THEN** Cancelar recibe foco, el fondo no puede activarse y Tab recorre sólo sus acciones

#### Scenario: Cierre o desmontaje
- **WHEN** el dueño cierra la confirmación o retira su componente
- **THEN** termina la modalidad y el foco regresa al control de origen disponible

### Requirement: Cancelación y aprobación explícitas
Escape, Cancelar y clic en fondo MUST comunicar rechazo; ninguno MUST aprobar
ni recordar permisos. Las acciones MUST NOT enviar un formulario contenedor.
Arrastrar desde el contenido al fondo MUST NOT decidir. La opción permanente
MUST aparecer sólo cuando el servicio la ofrezca.

#### Scenario: Escape o fondo
- **WHEN** la persona cancela por Escape o clic en fondo
- **THEN** se comunica rechazo sin confirmar, recordar ni disparar shortcuts por burbujeo

#### Scenario: Aprobación elegida
- **WHEN** la persona activa la acción de aprobación ofrecida
- **THEN** sólo se comunica la decisión seleccionada y no se envía un formulario exterior

### Requirement: Renovación y propiedad de solicitud
Cambiar identidad, contenido o alternativas de la solicitud MUST reiniciar foco
y lectura en un destino seguro. Esto MUST ocurrir también si una solicitud nueva
tiene el mismo texto. La presentación MUST delegar la resolución al dueño y
MUST NOT limpiar otra revisión pendiente desde un callback obsoleto.

#### Scenario: Nueva solicitud idéntica
- **WHEN** llega otra solicitud con identidad diferente y el mismo contenido
- **THEN** se renueva el foco seguro en lugar de mantener una aprobación enfocada

#### Scenario: Resolución previa tardía
- **WHEN** se invoca una decisión de una solicitud reemplazada
- **THEN** el dueño conserva la revisión actual sin que la presentación la retire

#### Scenario: Gesto iniciado sobre una solicitud reemplazada
- **WHEN** cambia la solicitud entre pulsar y soltar sobre una acción de aprobación
- **THEN** ese gesto previo no decide sobre la nueva solicitud y ésta sigue pendiente

### Requirement: Lectura con zoom y movimiento reducido
Contenido y acciones MUST permanecer accesibles mediante desplazamiento interno
a 200% en el viewport probado. La preferencia de movimiento reducido MUST retirar
animación no esencial del diálogo y transiciones de sus acciones.

#### Scenario: Confirmación extensa
- **WHEN** el contenido desborda la tarjeta a 200% de zoom
- **THEN** su inicio sigue disponible y Tab permite llegar a todas las acciones sin recortar el viewport

#### Scenario: Movimiento reducido
- **WHEN** está activa la preferencia de movimiento reducido
- **THEN** la presentación de confirmación no ejecuta animaciones no esenciales

### Requirement: Contraste de la acción principal
La acción principal MUST conservar contraste de texto de al menos 4.5:1 en
reposo y hover para sus variantes de comando, correo y borrado, en los dos temas
del renderer. Su etiqueta y tono MUST seguir distinguiendo la consecuencia.

#### Scenario: Variantes con texto pequeño
- **WHEN** se muestran las variantes de confirmación y se apunta a su acción principal
- **THEN** texto y fondo conservan al menos 4.5:1 en reposo y hover sin depender sólo del color
