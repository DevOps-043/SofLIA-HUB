## Purpose

Permite al usuario adjuntar video y audio del escritorio a una conversación con SofLIA, eligiendo la ruta de envío adecuada al tamaño del archivo y mostrando el estado real del adjunto antes de que el turno se resuelva.

## ADDED Requirements

### Requirement: Adjuntos de video y audio

El sistema SHALL aceptar adjuntos de video y audio en los formatos admitidos por el modelo del turno, y MUST rechazar con motivo visible un archivo cuyo formato o tamaño no pueda enviarse.

#### Scenario: Adjunto de video admitido

- **WHEN** el usuario adjunta un archivo de video en un formato admitido
- **THEN** el compositor lo acepta, muestra su nombre, duración y tamaño, y lo incluye en el siguiente turno

#### Scenario: Adjunto de audio admitido

- **WHEN** el usuario adjunta un archivo de audio en un formato admitido
- **THEN** el compositor lo acepta, muestra su nombre y duración, y lo incluye en el siguiente turno

#### Scenario: Formato no admitido

- **WHEN** el usuario adjunta un archivo de medio en un formato que el modelo no acepta
- **THEN** el compositor lo rechaza indicando el formato recibido y la lista de formatos admitidos, y no lo incorpora al turno

#### Scenario: Archivo que excede el límite del proveedor

- **WHEN** el archivo supera el límite máximo de subida
- **THEN** el compositor lo rechaza indicando el tamaño del archivo y el límite aplicable, y sugiere recortar el fragmento relevante

### Requirement: Lectura del adjunto sin agotar memoria

El sistema SHALL leer los adjuntos de medio por su ruta en disco y MUST no materializar en memoria del renderer un archivo que supere el presupuesto en línea.

#### Scenario: Video grande adjuntado

- **WHEN** el usuario adjunta un video que supera el presupuesto en línea
- **THEN** el sistema conserva la referencia a su ruta, transfiere el archivo por la ruta de subida remota y en ningún momento lo codifica completo en el renderer

#### Scenario: Archivo eliminado antes del envío

- **WHEN** el archivo adjuntado deja de existir o deja de ser legible antes de enviarse el turno
- **THEN** el sistema informa que el adjunto ya no está disponible y el turno se envía sin él

### Requirement: Estado visible del adjunto

El sistema SHALL exponer al usuario el estado de cada adjunto de medio —pendiente, subiendo, procesando, listo o fallido— y MUST permitir cancelar una subida en curso.

#### Scenario: Subida en curso

- **WHEN** un adjunto se está transfiriendo al proveedor
- **THEN** el compositor muestra el estado de subida y el envío del turno espera a que el adjunto esté listo o falle

#### Scenario: Cancelación por el usuario

- **WHEN** el usuario cancela un adjunto durante la subida
- **THEN** el sistema aborta la transferencia, elimina el adjunto del turno y no deja el compositor bloqueado

#### Scenario: Fallo declarado

- **WHEN** la subida o el procesamiento de un adjunto falla
- **THEN** el compositor marca ese adjunto como fallido con su causa y permite reintentar o retirarlo sin perder el texto escrito

### Requirement: Límites por turno

El sistema SHALL acotar la cantidad y la duración total de medios por turno, y MUST informar al usuario cuando un adjunto adicional excedería ese límite.

#### Scenario: Límite de adjuntos alcanzado

- **WHEN** el usuario intenta adjuntar un medio adicional que supera el máximo por turno
- **THEN** el compositor lo rechaza indicando el límite y conserva los adjuntos ya aceptados

#### Scenario: Duración total excedida

- **WHEN** la duración combinada de los medios adjuntos supera el máximo por turno
- **THEN** el sistema informa el exceso y propone acotar un fragmento antes de enviar
