## Purpose

Garantizar que el chat resuma el documento actualmente visible con evidencia verificable, sin sustituirlo por recuerdos de otras conversaciones ni afirmar éxito cuando la lectura no terminó.

## ADDED Requirements

### Requirement: Lectura del documento activo
El sistema SHALL reconocer una solicitud de leer, analizar o resumir "el documento" como una referencia al documento de la pestaña activa cuando el navegador integrado esté visible. La lectura SHALL devolver identidad de pestaña, URL, título, texto completo disponible y estado de truncamiento.

#### Scenario: Resumen de Google Docs visible
- **WHEN** el usuario pide "Dame un resumen del Documento" mientras un Google Docs está visible
- **THEN** el sistema lee semánticamente el documento desde la sesión autenticada de esa misma pestaña y fundamenta el resumen en ese texto

#### Scenario: Documento no extraíble
- **WHEN** la pestaña activa no entrega contenido documental legible
- **THEN** el sistema informa que no pudo leer el documento y no usa otra pestaña ni un recuerdo como sustituto

#### Scenario: Cambio de pestaña durante la lectura
- **WHEN** la pestaña activa, su URL o su contenido objetivo cambia antes de completar la extracción
- **THEN** el sistema descarta el resultado incompatible y solicita una lectura nueva antes de responder

### Requirement: Memoria subordinada a evidencia viva
El sistema MUST aislar los mensajes recientes por conversación y MUST tratar recuerdos históricos como contexto secundario cuando el turno depende de una fuente viva.

#### Scenario: Conversación nueva después de trabajar con otra fuente
- **WHEN** una conversación nueva pide un resumen del documento visible y la memoria contiene resúmenes de otro documento
- **THEN** el sistema no presenta el contenido recordado como si perteneciera al documento activo

#### Scenario: Continuidad dentro de la misma conversación
- **WHEN** el usuario hace una pregunta de seguimiento en la misma conversación
- **THEN** el sistema conserva el historial de esa conversación sin mezclar mensajes recientes de otras conversaciones

### Requirement: Finalización honesta del bucle
El sistema MUST distinguir entre completar una respuesta y agotar el presupuesto de herramientas. Al agotarlo sin texto final, SHALL informar que no pudo completar la respuesta y aportar el último estado conocido sin afirmar éxito.

#### Scenario: Presupuesto de herramientas agotado
- **WHEN** el agente consume todas las iteraciones permitidas sin producir una respuesta final
- **THEN** el sistema muestra un mensaje de fallo recuperable y nunca muestra "He ejecutado las acciones solicitadas"

#### Scenario: Resumen de solo lectura con evidencia disponible
- **WHEN** la lectura documental devuelve texto utilizable y la solicitud no pide mutaciones
- **THEN** el sistema produce el resumen sin iniciar Computer Use ni requerir confirmación humana

