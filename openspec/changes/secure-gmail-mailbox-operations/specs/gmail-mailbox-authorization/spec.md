## Purpose

Proteger las operaciones directas del buzón y hacer observables sus efectos parciales, evitando confirmaciones obsoletas, resultados falsos y repetición de mensajes durante cambios masivos.

## ADDED Requirements

### Requirement: Frontera autenticada y tipada
Los nueve canales de lectura y etiquetas/mensajes MUST validar ventana, frame, documento, sesión y payload cerrado. El servicio MUST fijar owner y conexión, revalidar esperas y no devolver contenido a un actor nuevo. Antes de producir efectos, las seis mutaciones MUST exigir HITL contextual en main y compartir exclusión por cuenta con planes.

#### Scenario: Actor o argumento ajeno
- **WHEN** una llamada procede de otro frame/sesión o contiene ID/opciones inválidos
- **THEN** se rechaza antes de efectos y no revela errores privados ni contenido

### Requirement: Preparación completa del alcance
El sistema MUST validar todas las referencias y seleccionar mensajes paginados antes de mutar. MUST detectar duplicados/ciclos y cuotas excesivas sin ejecutar una parte truncada. La confirmación MUST describir cuenta, acciones y alcance seleccionado.

#### Scenario: El lote mantiene la etiqueta origen
- **WHEN** se añade una etiqueta sin retirar la etiqueta origen
- **THEN** se procesa cada ID seleccionado una sola vez sin repetir la primera página

#### Scenario: Archivar desde Recibidos
- **WHEN** el usuario aprueba un lote coherente que retira INBOX de los mensajes seleccionados
- **THEN** se permite el cambio sobre el snapshot conservando la etiqueta de sistema

### Requirement: Avance y fallo honestos
Cada operación MUST conservar conteos de efectos confirmados durante la llamada y devolver partial/uncertain/recoveryRequired cuando corresponda. MUST detenerse ante fallo/contexto inválido, desactivar retry del SDK y no anunciar éxito con errores. Si no se verificó remaining MUST indicarlo sin inventar cero.

#### Scenario: Falla un lote o etiqueta posterior
- **WHEN** existe avance confirmado y una solicitud posterior falla
- **THEN** se conservan los conteos previos, no se ejecutan efectos posteriores y se requiere revisar Gmail antes de repetir

### Requirement: Borrado con precondiciones
El sistema MUST rechazar borrar etiquetas de sistema. Un borrado posterior al vaciado MUST comprobar que la etiqueta siga vacía y no ampliar el snapshot aprobado con mensajes recién llegados.

#### Scenario: Mensaje nuevo o etiqueta no vacía
- **WHEN** quedan mensajes en la etiqueta después de procesar el snapshot
- **THEN** la etiqueta se conserva y se informa conflicto u operación incompleta
