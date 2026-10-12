## ADDED Requirements

### Requirement: Abrir entregables dentro del chat
El sistema MUST mostrar una vista previa local al pulsar un archivo comprobado
del equipo y permitir cambiar entre todos sus entregables sin salir del chat.

#### Scenario: El equipo produjo varios archivos
- **WHEN** el usuario pulsa una tarjeta comprobada
- **THEN** el visor muestra su contenido y permite seleccionar los demás archivos
- **AND** no depende de aplicaciones predeterminadas de Windows

### Requirement: Soportar lectura de archivos y aplicaciones HTML
El visor MUST admitir Markdown, texto, Word, Excel/CSV, PowerPoint, PDF e imágenes
y aplicaciones HTML autocontenidas, con límites y diferencias de fidelidad visibles.

#### Scenario: Hoja de cálculo con fórmulas
- **WHEN** se abre un libro Excel
- **THEN** el visor muestra hojas y valores calculados guardados sin evaluar código

#### Scenario: Aplicación HTML
- **WHEN** se abre un HTML local elegido explícitamente
- **THEN** los scripts locales pueden interactuar en un origen opaco
- **AND** no pueden acceder al chat, IPC, disco, red ni navegación externa

### Requirement: Autorizar archivos y rechazar resultados obsoletos
Main MUST resolver solo referencias de equipos autorizados o archivos elegidos
en el selector nativo y verificar contexto, integridad, formato y límites.

#### Scenario: Cambio de sesión durante la lectura
- **WHEN** cambia el usuario o la organización durante una vista previa
- **THEN** main rechaza la respuesta anterior y el renderer desmonta su contenido

#### Scenario: Referencia o archivo alterado
- **WHEN** la referencia contiene una ruta arbitraria o el archivo cambió
- **THEN** no se lee ni abre y el usuario recibe un error controlado

### Requirement: Exportación explícita
El visor MUST permitir guardar una copia mediante selector nativo y abrir un
formato permitido fuera de PulseHub únicamente por acción explícita del usuario.

#### Scenario: Usuario cancela el selector
- **WHEN** se cancela Abrir archivo o Guardar copia
- **THEN** no se modifica ningún archivo ni se trata como un error
