## ADDED Requirements

### Requirement: Vista de navegador integrada
El sistema SHALL ofrecer a cada usuario autenticado una vista de navegador dentro del workspace de SofLIA con barra de dirección, atrás, adelante, recarga o detención, foco y estado de carga/error.

#### Scenario: Navegación manual exitosa
- **WHEN** el usuario abre Navegador e introduce una URL HTTP(S) válida
- **THEN** el sistema muestra el sitio dentro del workspace y actualiza URL, título, carga e historial

#### Scenario: Búsqueda desde la barra
- **WHEN** el usuario introduce texto que no es una URL
- **THEN** el sistema navega a una búsqueda HTTPS con el texto codificado

#### Scenario: Error de navegación
- **WHEN** la carga principal falla
- **THEN** la barra conserva un estado observable con mensaje seguro y permite reintentar o navegar a otra dirección

### Requirement: Sesión persistente y aislada
El sistema SHALL conservar cookies y almacenamiento web en una partición persistente exclusiva del navegador integrado y MUST aislarla del renderer privilegiado y de perfiles externos.

#### Scenario: Reapertura de la vista
- **WHEN** el usuario oculta y vuelve a abrir Navegador durante la misma sesión
- **THEN** la página y sesión web continúan disponibles sin crear otro navegador

#### Scenario: Reinicio de Pulse Hub
- **WHEN** el usuario reinicia Pulse Hub y vuelve a un sitio visitado
- **THEN** el sitio puede usar la sesión guardada en la partición propia del navegador integrado

#### Scenario: Contenido remoto aislado
- **WHEN** un sitio intenta acceder a Node, preload o IPC de SofLIA
- **THEN** esas capacidades no existen en su contexto

### Requirement: Navegación segura y permisos gobernados
El sistema MUST validar toda navegación y MUST denegar por defecto protocolos y permisos web no declarados.

#### Scenario: Protocolo peligroso
- **WHEN** usuario o sitio intenta navegar a `file:`, `javascript:`, `data:` o un protocolo interno
- **THEN** el sistema cancela la navegación y devuelve un error seguro sin cargar el recurso

#### Scenario: Permiso sensible aprobado
- **WHEN** la vista integrada solicita cámara, micrófono o ubicación y el usuario aprueba el diálogo nativo
- **THEN** el sistema concede únicamente esa solicitud al origen mostrado

#### Scenario: Permiso sensible denegado
- **WHEN** el usuario rechaza la solicitud o el permiso no está allowlisted
- **THEN** el sistema deniega la capacidad sin afectar la UI principal

#### Scenario: Ventana emergente HTTP(S)
- **WHEN** un sitio intenta abrir una ventana HTTP(S)
- **THEN** el sistema carga el destino en la misma vista integrada y no crea una ventana sin gobierno

### Requirement: Control compartido con el agente
El agente de escritorio SHALL poder revelar el navegador integrado, capturar la misma página visible y ejecutar acciones de Computer Use sobre ella cuando el usuario solicite una tarea web.

#### Scenario: Agente abre el navegador
- **WHEN** `use_computer` recibe una tarea web y la vista no está activa
- **THEN** el sistema muestra/enfoca Pulse Hub, cambia a Navegador y espera un viewport válido antes de capturar

#### Scenario: Agente continúa la página del usuario
- **WHEN** el usuario ya tiene una página abierta y solicita al agente actuar en ella
- **THEN** la primera observación del agente corresponde al mismo URL y contenido visible, preservando la sesión

#### Scenario: Acciones visibles
- **WHEN** Computer Use ejecuta click, escritura, scroll, navegación o historial
- **THEN** el sistema inyecta la acción en el `webContents` integrado y el usuario observa el resultado en la misma vista

#### Scenario: Vista no disponible
- **WHEN** el renderer no publica un viewport visible dentro del timeout
- **THEN** la tarea termina con estado no completado y un error controlado, sin actuar sobre otra ventana

### Requirement: IPC tipado y validado
El sistema SHALL implementar cada operación del navegador mediante servicio main, handler validado, canal allowlisted/API preload y wrapper tipado de renderer.

#### Scenario: Payload válido
- **WHEN** el renderer autenticado invoca una operación con un payload válido y desde la ventana principal
- **THEN** el handler ejecuta el servicio y devuelve `{ success: true, state? }`

#### Scenario: Bounds inválidos
- **WHEN** el renderer envía coordenadas no enteras, negativas, enormes o fuera del contenido de la ventana
- **THEN** el handler rechaza o ajusta el payload según el contrato sin desbordar la vista sobre UI no reservada

#### Scenario: Canal no permitido
- **WHEN** el renderer intenta invocar un canal que no está en la allowlist
- **THEN** el preload rechaza la llamada antes de llegar al main

### Requirement: Ciclo de vida recuperable
El servicio SHALL administrar un único navegador integrado por ventana principal y MUST liberar vista, `webContents`, listeners y esperas al cerrarse.

#### Scenario: Aperturas repetidas
- **WHEN** usuario o agente solicita abrir Navegador varias veces
- **THEN** el sistema reutiliza la misma instancia y no duplica listeners ni vistas

#### Scenario: Cierre de la ventana principal
- **WHEN** la ventana principal se destruye
- **THEN** el servicio cancela esperas pendientes, remueve la vista y destruye sus recursos de forma idempotente
