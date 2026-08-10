## Purpose

Define cómo el producto resuelve la identidad visual de la organización del usuario para aplicarla a los entregables que genera, de forma que un documento creado por SofLIA se vea corporativo sin que el usuario tenga que aportar colores ni logotipos.

## ADDED Requirements

### Requirement: Resolución de la identidad de la organización

El sistema SHALL resolver la identidad visual de la organización activa del usuario a partir de los datos ya registrados en la plataforma: colores de marca, tipografía, logo, favicon y banner. La resolución SHALL requerir una sesión de usuario con organización asociada.

#### Scenario: Usuario con organización

- **WHEN** un usuario autenticado con organización activa solicita un entregable con identidad corporativa
- **THEN** el sistema resuelve los colores, la tipografía y los recursos gráficos de esa organización

#### Scenario: Usuario sin organización

- **WHEN** el usuario no tiene una organización asociada
- **THEN** el sistema no intenta resolver identidad corporativa y devuelve el tema neutro del producto

#### Scenario: Sin sesión

- **WHEN** no hay sesión activa
- **THEN** el sistema devuelve el tema neutro y no consulta datos de ninguna organización

### Requirement: Branding deshabilitado y datos incompletos

El sistema SHALL aplicar la identidad corporativa solo cuando la organización tiene el branding habilitado. Cuando el branding está deshabilitado o faltan valores, el sistema SHALL completar con el tema neutro del producto y MUST NOT inventar colores, tipografías ni logotipos.

#### Scenario: Branding deshabilitado

- **WHEN** la organización del usuario tiene el branding deshabilitado
- **THEN** el sistema devuelve el tema neutro e indica que la identidad corporativa no está habilitada

#### Scenario: Identidad parcial

- **WHEN** la organización tiene colores de marca pero no logo
- **THEN** el sistema aplica los colores disponibles, omite el logo y señala el recurso faltante

### Requirement: Descarga acotada de recursos de marca

Los recursos gráficos de marca SHALL descargarse únicamente desde el origen configurado de la plataforma. El sistema MUST rechazar direcciones de otros orígenes, SHALL aplicar un límite de tamaño y un tiempo máximo de espera por recurso, y SHALL guardar el recurso descargado junto al entregable para que funcione sin conexión.

#### Scenario: Descarga válida

- **WHEN** el recurso de marca pertenece al origen configurado de la plataforma
- **THEN** el sistema lo descarga y lo guarda junto al entregable

#### Scenario: Origen no permitido

- **WHEN** la dirección de un recurso de marca apunta a un origen distinto del configurado
- **THEN** el sistema no realiza la descarga y trata el recurso como ausente

#### Scenario: Recurso demasiado grande o lento

- **WHEN** un recurso supera el límite de tamaño o el tiempo máximo de espera
- **THEN** el sistema aborta la descarga, trata el recurso como ausente y no bloquea la generación del entregable

### Requirement: Caché acotada de la identidad

El sistema SHALL cachear la identidad resuelta por organización durante una ventana acotada para evitar consultas repetidas dentro de una misma sesión de trabajo, y SHALL invalidar la caché al cambiar de organización activa o al cerrar sesión.

#### Scenario: Segunda generación en la misma sesión

- **WHEN** el usuario genera un segundo entregable poco después del primero
- **THEN** el sistema reutiliza la identidad ya resuelta sin volver a consultar la plataforma

#### Scenario: Cambio de organización

- **WHEN** el usuario cambia de organización activa
- **THEN** el sistema descarta la identidad cacheada y resuelve la de la nueva organización

#### Scenario: Cierre de sesión

- **WHEN** el usuario cierra sesión
- **THEN** el sistema descarta la identidad cacheada y los datos de organización dejan de estar disponibles

### Requirement: Ausencia de datos sensibles en la identidad

La identidad resuelta SHALL limitarse a datos de presentación visual. El sistema MUST NOT exponer credenciales, claves de servicio, datos de suscripción ni información de miembros de la organización como parte de la identidad entregada al generador.

#### Scenario: Contenido de la identidad

- **WHEN** el sistema entrega la identidad resuelta al generador de un entregable
- **THEN** la identidad contiene únicamente colores, tipografía y referencias a recursos gráficos, sin credenciales ni datos de suscripción ni datos de miembros
