## Purpose

Compartir archivos seleccionados y aprobados hacia un proyecto autorizado conservando tokens temporales y bytes en main, con destino comprobado y cancelación verificable.

## ADDED Requirements

### Requirement: Selección nativa y bytes aprobados
El sistema MUST seleccionar archivos mediante diálogo nativo, validar todo el lote antes de efectos remotos y exigir confirmación de destino/declaraciones. MUST rechazar selecciones excesivas sin recortar y archivos modificados después de aprobar.

#### Scenario: Cambio de archivo tras aprobar
- **WHEN** los bytes ya no coinciden con el tamaño/hash revisados
- **THEN** no se crea intención ni se suben los bytes modificados

#### Scenario: Selección inválida
- **WHEN** hay más de diez archivos, tamaño/tipo/firma inválidos o archivo no regular
- **THEN** se rechaza el lote antes de crear intenciones

### Requirement: Token y destino privados
El sistema MUST conservar URLs/tokens de subida en main y permitir PUT sólo al origen storage configurado y path exacto del proyecto/evidence devueltos para ese archivo. MUST bloquear redirects, URLs ambiguas y repeticiones automáticas.

#### Scenario: Intención maliciosa o incoherente
- **WHEN** host/path/token/cantidad de intenciones no coinciden con el contrato
- **THEN** no se envían bytes ni credenciales al destino

### Requirement: Ciclo cancelable y progreso honesto
El sistema MUST invalidar el lote por cambio de caller/sesión o cancelación explícita, detener el siguiente efecto y liberar handles/listeners. MUST informar sólo progreso confirmado y resultado incierto cuando corresponda; MUST NOT completar tras PUT fallido ni prometer rollback.

#### Scenario: Fallo después de completar un archivo
- **WHEN** falla o se cancela un archivo posterior
- **THEN** conserva el contador confirmado y requiere revisar pendientes sin repetir el lote automáticamente

### Requirement: Cuatro capas integradas
El sistema MUST retirar primitivas renderer de intención/complete y exponer sólo subir/cancelar por destino e ID de operación. UI MUST cancelar al desmontarse o cambiar proyecto y no publicar respuestas del destino anterior.

#### Scenario: Renderer cambia de proyecto
- **WHEN** hay una subida en curso y se cambia el destino de la vista
- **THEN** se solicita cancelación del lote anterior y su resultado no modifica el proyecto nuevo
