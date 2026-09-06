## Purpose

Garantizar que la identidad SOFIA usada por la interfaz y los servicios de Electron sea verificable, recuperable y esté sometida a las mismas políticas de organización y membresía.

## ADDED Requirements

### Requirement: La sesión visible de SOFIA es verificable
El sistema SHALL considerar autenticado al usuario únicamente cuando exista una sesión Supabase SOFIA verificable con tokens vigentes. Un snapshot local de perfil SHALL servir solo para presentación y no SHALL fabricar una sesión ni habilitar consultas o funciones protegidas.

#### Scenario: Restauración con sesión verificable
- **WHEN** el cliente restaura una sesión Supabase SOFIA válida
- **THEN** el sistema carga el perfil, las organizaciones y las membresías con esa identidad

#### Scenario: Snapshot local sin sesión verificable
- **WHEN** existe un perfil local guardado pero no una sesión Supabase SOFIA válida
- **THEN** el sistema limpia el estado autenticado y solicita iniciar sesión en vez de mostrar una sesión degradada permanente

#### Scenario: Falla transitoria con sesión válida
- **WHEN** existe una sesión verificable pero la consulta de perfil falla por red o indisponibilidad
- **THEN** el sistema conserva la sesión y muestra el estado degradado recuperable sin afirmar que el usuario carece de organizaciones

### Requirement: Main opera con la identidad SOFIA del usuario
El renderer SHALL publicar a main los tokens vigentes de SOFIA por un canal unidireccional. Main SHALL aplicar esa sesión a su cliente SOFIA antes de autorizar consultas de identidad, organización o canal, y SHALL mantener las consultas sujetas a RLS.

#### Scenario: Publicación de una sesión SOFIA
- **WHEN** el renderer publica estado autenticado con tokens SOFIA válidos
- **THEN** main aplica la sesión al cliente SOFIA y asocia el estado protegido con el usuario devuelto por el proveedor

#### Scenario: Payload sin tokens SOFIA
- **WHEN** main recibe estado autenticado sin ambos tokens SOFIA
- **THEN** no habilita una nueva identidad SOFIA ni interpreta el identificador declarado como prueba de autenticación

#### Scenario: Credenciales de ida
- **WHEN** el renderer publica o consulta el estado de autenticación
- **THEN** ninguna respuesta IPC, traza ni estado observable contiene tokens SOFIA

#### Scenario: Sesión de otro usuario
- **WHEN** el identificador publicado no coincide con el usuario autenticado por los tokens SOFIA
- **THEN** main rechaza la aplicación de esa identidad y mantiene negadas las funciones protegidas

### Requirement: La identidad SOFIA se restaura en frío
Main SHALL custodiar solamente el refresh token SOFIA cifrado por el sistema operativo y SHALL intentar restaurarlo antes de inicializar los servicios que consultan organizaciones o atienden canales.

#### Scenario: Arranque con token guardado válido
- **WHEN** Pulse Hub arranca con un refresh token SOFIA cifrado y válido
- **THEN** main restaura la sesión, establece el usuario autenticado e inicializa después los servicios de WhatsApp y detección pasiva

#### Scenario: Arranque sin cifrado seguro
- **WHEN** el sistema operativo no ofrece cifrado seguro
- **THEN** main usa la sesión solo en memoria y no persiste el refresh token en texto plano

#### Scenario: Token guardado inválido
- **WHEN** el refresh token guardado está corrupto, caducado o revocado
- **THEN** main lo descarta, arranca con las funciones protegidas negadas y no bloquea la apertura de la aplicación

#### Scenario: Renovación de token
- **WHEN** SOFIA renueva el refresh token de la sesión de main
- **THEN** main reemplaza de forma cifrada el token guardado sin registrar su valor

### Requirement: Logout revoca todas las copias de la identidad SOFIA
El sistema SHALL borrar la credencial SOFIA custodiada por main y cerrar localmente su cliente al cerrar sesión en el Hub.

#### Scenario: Cierre de sesión
- **WHEN** el renderer publica `authenticated: false`
- **THEN** main borra el refresh token SOFIA, cierra la sesión local del cliente y devuelve el estado protegido a no autenticado

### Requirement: WhatsApp responde solo a identidades autorizadas
El canal WhatsApp SHALL resolver al remitente y su membresía con la sesión SOFIA autenticada de main. Las preferencias de presencia o confirmación de lectura de WhatsApp no SHALL intervenir en esta autorización.

#### Scenario: Mensaje directo autorizado
- **WHEN** llega un mensaje de un número permitido que corresponde a un usuario con membresía activa y capacidad `personal_agent`
- **THEN** el mensaje atraviesa las guardas y se entrega al agente

#### Scenario: Sesión SOFIA ausente
- **WHEN** llega un mensaje pero main no tiene sesión SOFIA verificable
- **THEN** el mensaje se descarta con un motivo auditable y no se relajan RLS, allowlists ni capacidades

#### Scenario: Preferencias de privacidad desactivadas
- **WHEN** el usuario desactiva confirmaciones de lectura o visibilidad de última conexión en WhatsApp
- **THEN** la recepción, resolución de identidad y entrega al agente conservan el mismo comportamiento de autorización
