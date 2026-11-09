## Purpose

Mantener los resultados de Gmail dentro del alcance de las llamadas realmente ejecutadas por el agente de WhatsApp, evitando instrucciones implícitas de vaciado y respuestas sin llamada correspondiente.

## ADDED Requirements

### Requirement: Feedback limitado a llamadas reales
El runtime MUST entregar únicamente el resultado de cada llamada Gmail ejecutada, en su orden. MUST NOT consultar toda una etiqueta ni ordenar vaciarla como consecuencia implícita de modificar un mensaje. MUST NOT fabricar otra functionResponse sin llamada asociada.

#### Scenario: Modificar un mensaje deja otros en la etiqueta
- **WHEN** una modificación individual se confirma y la etiqueta contiene más mensajes
- **THEN** el loop entrega un único resultado de esa modificación y no consulta ni ordena procesar el resto

#### Scenario: Hay otra página disponible
- **WHEN** una consulta Gmail devuelve token para otra página
- **THEN** el resultado conserva token y disponibilidad como datos sin una orden añadida de continuar leyendo

### Requirement: Conservar resultados y guardas
Los conteos y flags partial/uncertain/recoveryRequired/cancelled/conflict MUST conservarse del servicio al modelo. Las guardas de grupo, intención, confirmación y sesión existentes MUST seguir aplicándose. El runtime MUST NOT transportar estado de verificación Gmail por ejecutores ajenos.

#### Scenario: Operación parcial o cancelada
- **WHEN** el servicio informa un avance parcial, incertidumbre o cancelación
- **THEN** se entrega ese resultado sin reemplazarlo por éxito ni una orden de continuar

### Requirement: Correspondencia del proveedor y privacidad
Cada resultado MUST mantener correspondencia con la llamada pendiente en el adaptador de chat. El cambio MUST retirar logs del verificador con IDs/errores privados y no incorporar errores crudos del ejecutor de etiquetas.
El adaptador MUST rechazar resultados extra antes de modificar historial/pending y MUST validar el lote del proveedor antes de publicar llamadas pendientes, incluyendo catálogo, argumentos y unicidad de call_id.

#### Scenario: Varias llamadas en la misma respuesta
- **WHEN** se ejecutan herramientas Gmail y otras herramientas en un turno
- **THEN** cada llamada recibe su resultado correspondiente sin respuestas extra ni lecturas de etiquetas añadidas

#### Scenario: Lote inválido después de un prefijo válido
- **WHEN** el proveedor añade una llamada inválida o ID duplicado después de otra llamada válida
- **THEN** se rechaza todo el lote sin dejar ese prefijo en historial ni pending
