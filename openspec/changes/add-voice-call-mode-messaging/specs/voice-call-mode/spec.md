## Purpose

Define una conversación hablada sostenida entre el usuario y SofLIA por WhatsApp
y Telegram, con el catálogo completo de herramientas del agente disponible
durante la charla, sin alterar guardas, permisos ni confirmaciones.

## ADDED Requirements

### Requirement: Salida hablada en canales de mensajería
El sistema SHALL sintetizar la respuesta del agente como nota de voz con la voz
identificada por `ELEVENLABS_VOICE_ID` y MUST entregarla en contenedor OGG con
códec Opus, marcada como nota de voz en WhatsApp (`ptt`) y como `voice` en
Telegram.

#### Scenario: Respuesta hablada en WhatsApp
- **WHEN** el modo llamada está activo en un chat directo y el agente resuelve un turno
- **THEN** el sistema envía la respuesta como nota de voz reproducible y la registra en el historial de conversación

#### Scenario: Respuesta hablada en Telegram
- **WHEN** el modo llamada está activo en un chat de Telegram y el agente resuelve un turno
- **THEN** el sistema envía la respuesta con `sendVoice` y el mensaje aparece como nota de voz

#### Scenario: Respuesta más larga que el límite hablado
- **WHEN** la respuesta supera el máximo de caracteres sintetizables
- **THEN** el sistema habla la parte inicial y entrega el resto como texto en el mismo turno, sin descartar contenido

### Requirement: Entrada hablada en ambos canales
El sistema SHALL aceptar notas de voz entrantes en WhatsApp y Telegram, SHALL
transcribirlas y MUST procesarlas por la misma ruta de agente que un mensaje de
texto, conservando prefiltro de seguridad, permisos y confirmaciones.

#### Scenario: Nota de voz en Telegram
- **WHEN** llega un update con `voice` o `audio` de un chat autorizado
- **THEN** el sistema descarga el archivo, lo transcribe y ejecuta el turno del agente con esa transcripción

#### Scenario: Audio ininteligible
- **WHEN** la transcripción resulta vacía
- **THEN** el sistema pide repetir el mensaje y no invoca el loop del agente

### Requirement: Modo llamada con contexto continuo
El sistema SHALL mantener una sesión de modo llamada por canal y chat que
determina si las respuestas salen habladas, SHALL abrirla al recibir `/llamar`,
al recibir una nota de voz o al detectar una llamada entrante, y SHALL cerrarla
con `/colgar` o por inactividad.

#### Scenario: Apertura por voz sin comando previo
- **WHEN** el usuario envía una nota de voz en un chat directo sin modo llamada activo
- **THEN** el sistema abre el modo llamada y responde hablando

#### Scenario: Cierre explícito
- **WHEN** el usuario envía `/colgar`
- **THEN** el sistema cierra la sesión, confirma por texto y las respuestas siguientes vuelven a ser escritas

#### Scenario: Vencimiento por inactividad
- **WHEN** transcurre el plazo de inactividad sin turnos nuevos
- **THEN** la sesión caduca y el siguiente turno se responde por texto

#### Scenario: Modo llamada no disponible en grupos
- **WHEN** se solicita `/llamar` en un grupo
- **THEN** el sistema rechaza la apertura e informa que el modo llamada solo opera en chats directos

### Requirement: Herramientas completas durante la conversación hablada
Durante el modo llamada el agente MUST conservar el mismo catálogo de
herramientas, guardas duras, bloqueos de grupo y confirmaciones HITL que en un
turno escrito, sin ampliar ni reducir permisos por el hecho de hablar.

#### Scenario: Acción ejecutada por voz
- **WHEN** el usuario pide por voz una búsqueda web, una skill o una acción de computer use permitida
- **THEN** el agente ejecuta la herramienta correspondiente y relata el resultado hablando

#### Scenario: Herramienta que exige confirmación
- **WHEN** el agente invoca por voz una herramienta que requiere confirmación explícita
- **THEN** el sistema solicita la confirmación también por texto y MUST NOT ejecutar la acción hasta recibir una respuesta afirmativa

#### Scenario: Herramienta bloqueada por permisos
- **WHEN** el remitente no tiene permiso para la herramienta solicitada por voz
- **THEN** el sistema deniega la ejecución con el mismo criterio que en un turno escrito

### Requirement: Llamada entrante de WhatsApp reconducida
El sistema SHALL observar los eventos de llamada de WhatsApp y, ante un `offer`
de un remitente autorizado en chat directo, MUST rechazar la llamada y SHALL
abrir el modo llamada con un aviso hablado que explique cómo conversar.

#### Scenario: Llamada de un número autorizado
- **WHEN** llega un evento de llamada con estado `offer` desde un número autorizado
- **THEN** el sistema rechaza la llamada, abre el modo llamada y envía un saludo hablado

#### Scenario: Llamada de un número no autorizado
- **WHEN** llega un `offer` desde un número sin autorización
- **THEN** el sistema rechaza la llamada y MUST NOT abrir sesión ni responder

### Requirement: Degradación visible sin voz disponible
Cuando la síntesis no esté configurada o el proveedor falle, el sistema MUST
entregar la respuesta como texto y SHALL avisar del fallo una sola vez por
sesión, sin filtrar el cuerpo interno del proveedor ni perder la respuesta.

#### Scenario: Credencial ausente
- **WHEN** falta `ELEVENLABS_API_KEY` o `ELEVENLABS_VOICE_ID` y el modo llamada está activo
- **THEN** el sistema responde por texto e informa una vez que la voz no está configurada

#### Scenario: Cuota agotada a mitad de conversación
- **WHEN** ElevenLabs rechaza la síntesis por falta de créditos
- **THEN** el sistema entrega la respuesta escrita con un aviso saneado y la conversación continúa
