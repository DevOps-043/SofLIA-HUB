## Purpose

Guardar copias íntegras de evidencia autorizada con destino nativo y ciclo de sesión vigente, manteniendo URL firmada y bytes fuera del renderer.

## ADDED Requirements

### Requirement: Evidencia y destino remoto comprobados
La descarga MUST validar IDs/upload/ready/no archivado, MIME/tamaño/hash y ruta de evidencia. MUST permitir sólo origen storage configurado, ruta exacta y token/TTL válidos, sin redirects ni credenciales de sesión al storage.

#### Scenario: URL o evidencia discordantes
- **WHEN** metadata, host/path/token o estado no cumplen el contrato
- **THEN** no se publica una copia ni se envían credenciales a otro origen

### Requirement: Copia íntegra aprobada
El sistema MUST pedir revisión/selector nativos y validar tamaño/hash/formato antes de publicar. MUST guardar exclusivamente una copia nueva completa y MUST NOT sobrescribir una colisión ni ejecutar automáticamente el archivo.

#### Scenario: Bytes inválidos o destino ocupado
- **WHEN** bytes no coinciden o aparece un archivo con el nombre elegido
- **THEN** se conserva el destino existente y no se publica un archivo parcial

### Requirement: Cancelación y publicación honesta
El sistema MUST cancelar por actor/caller/proyecto/id y liberar recursos, conservando exclusión con upload. MUST distinguir cancelación antes de publicación de copia ya publicada, sin borrar una copia aprobada por cancelación tardía.

#### Scenario: Cancelar durante red
- **WHEN** el caller navega o cancela mientras llegan bytes
- **THEN** se aborta y no se publica después

#### Scenario: Contexto cambia después del commit
- **WHEN** la copia completa ya fue publicada al invalidarse el contexto
- **THEN** el resultado indica saved real sin afirmar rollback ni exponer ruta

#### Scenario: Publicación sin confirmación
- **WHEN** la operación nativa de publicación falla sin acreditar el resultado
- **THEN** informa uncertain/recoveryRequired y pide revisar destino aunque se haya cancelado, sin afirmar ausencia de copia

### Requirement: Superficie integrada sin URL pública
El renderer MUST recibir sólo resultado/contadores seguros por download-file/cancel-download, nunca URL/token/ruta local. UI MUST ofrecer guardar uploads ready y descartar respuestas del destino anterior.

#### Scenario: Cambio de proyecto
- **WHEN** cambia la vista durante una descarga
- **THEN** solicita cancelación y no muestra el resultado ni las acciones del proyecto anterior
