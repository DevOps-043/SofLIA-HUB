## Purpose

Definir Telegram como **superficie de Skills** y no como un canal de comandos
fijos. Hasta ahora Telegram respondía un menú cerrado de operaciones del Hub de
Flujos; al retirarse ese motor, el canal necesita el mismo contrato que ya tiene
WhatsApp: catálogo, invocación y guardas equivalentes, resueltos desde la misma
fuente para que una Skill retirada no siga viva en un canal.

## ADDED Requirements

### Requirement: Catálogo de Skills en Telegram

El sistema SHALL ofrecer en Telegram las Skills del sistema que declaren esa
superficie y que el usuario tenga activas en ese canal. El catálogo SHALL
resolverse desde la misma fuente que el del chat del Hub y el de WhatsApp.

#### Scenario: El usuario pide el catálogo

- **WHEN** el usuario pide a SofLIA por Telegram qué sabe hacer
- **THEN** recibe la lista de Skills disponibles en ese canal con su nombre y su descripción

#### Scenario: Una Skill retirada del catálogo

- **WHEN** una Skill se marca como deshabilitada en el catálogo
- **THEN** Telegram deja de ofrecerla y rechaza su invocación, igual que las demás superficies

#### Scenario: Una Skill no declarada para Telegram

- **WHEN** el usuario invoca por Telegram una Skill que existe pero no declara esa superficie
- **THEN** el sistema explica que no está disponible por Telegram e indica dónde sí puede usarla

### Requirement: Invocación de Skills desde Telegram

El usuario SHALL poder invocar una Skill por Telegram con su comando o
describiendo lo que quiere. El sistema SHALL ejecutarla anexando sus
instrucciones al turno y concediéndole únicamente las herramientas permitidas
para esa superficie.

#### Scenario: Invocación por comando

- **WHEN** el usuario envía por Telegram el comando de una Skill disponible
- **THEN** el sistema ejecuta la Skill y devuelve el resultado por el mismo chat

#### Scenario: Se pide una presentación por Telegram

- **WHEN** el usuario pide por Telegram una presentación sobre un documento, una página o una investigación
- **THEN** el sistema ejecuta la Skill de Presentaciones y le entrega la presentación resultante

### Requirement: Guardas equivalentes a las de WhatsApp

Telegram SHALL aplicar las mismas guardas que el resto de canales de mensajería:
resolución del principal del remitente, autorización por capacidad, bloqueo de
las Skills marcadas como no permitidas en grupos, y la allowlist de herramientas
de la superficie. Una Skill MUST NOT obtener en Telegram nada que no obtendría
en WhatsApp por el mismo motivo.

#### Scenario: Skill bloqueada en grupos

- **WHEN** una Skill marcada como bloqueada en grupos se invoca desde un grupo de Telegram
- **THEN** el sistema la rechaza y explica que debe pedirse por privado

#### Scenario: Chat no autorizado

- **WHEN** un chat de Telegram que no está autorizado por la política del canal invoca una Skill
- **THEN** el sistema rechaza la invocación y deja constancia del intento

#### Scenario: Una Skill declara una herramienta no concedible

- **WHEN** una Skill disponible en Telegram declara una herramienta que la superficie no permite conceder
- **THEN** el sistema no se la concede, ejecuta la Skill con las restantes y deja constancia del descarte
