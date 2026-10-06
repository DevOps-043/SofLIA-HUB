## ADDED Requirements

### Requirement: Referencia implícita a la pestaña visible
El chat SHALL tratar «el siguiente/presente chat, conversación, hilo, correo, mensaje, página, artículo o publicación» como referencia a la pestaña activa cuando el mensaje no incluye contenido extenso propio.

#### Scenario: Frase reportada
- **WHEN** el usuario escribe «Realiza un resumen del siguiente Chat ya que mi jefe me pidio una opinion del mismo» con el navegador visible
- **THEN** el turno incorpora el contenido de la pestaña activa y no responde que carece de él

#### Scenario: Texto pegado
- **WHEN** el mensaje dice «Resume el siguiente chat:» seguido de más de 400 caracteres
- **THEN** no se lee la pestaña y se trabaja sobre el texto pegado

### Requirement: Contenido completo para resumir
Para resumir, analizar u opinar sobre la página o conversación visible, el chat MUST usar la lectura documental completa de la pestaña y SHALL recurrir a la observación visible sólo si esa lectura falla.

#### Scenario: Chat largo
- **WHEN** la conversación excede el viewport
- **THEN** el modelo recibe el texto completo hasta el límite documental, con aviso de truncamiento

#### Scenario: Lectura no disponible
- **WHEN** la lectura documental falla
- **THEN** el turno adjunta la observación visible en lugar de responder sin contexto

### Requirement: Turnos de chat en texto plano
La extracción MUST conservar, en orden y sin controles ni campos editables, los turnos marcados con `data-message-author-role` que no contienen bloques semánticos.

#### Scenario: Mensaje del usuario en ChatGPT
- **WHEN** el mensaje del usuario está en un `div` sin párrafos
- **THEN** aparece en el texto extraído entre los turnos del asistente
