## Purpose

Mantener archivos y estado de negocio consistentes entre ubicaciones y colaboradores, admitiendo desconexiones y cambios externos sin duplicar motores de sincronización o perder contenido silenciosamente.

## ADDED Requirements

### Requirement: Modalidades de sincronización identificables
El sistema SHALL soportar las modalidades confirmadas de cliente de escritorio y API directa en ambos proveedores, mostrando las capacidades disponibles por cuenta. SHALL evitar que dos motores de Soflia/clientes configurados por el producto operen simultáneamente sobre el mismo árbol sin una transición controlada.

#### Scenario: Abrir carpeta sincronizada
- **WHEN** se elige la carpeta local gestionada por OneDrive o Drive
- **THEN** el cliente del proveedor sincroniza bytes y Soflia administra manifiesto/vínculo y muestra el estado que realmente puede comprobar

#### Scenario: Activar API directa sobre raíz ya sincronizada
- **WHEN** se intenta usar otra modalidad sobre el mismo árbol conocido
- **THEN** requiere una transición revisada o elegir otro destino y no habilita dos escritores silenciosamente

### Requirement: Control de versiones y conflictos sin pérdida
El sistema SHALL detectar revisiones incompatibles y preservar versiones en conflicto. No usará sobrescritura silenciosa ni asumirá que todos los proveedores permiten una operación condicional atómica.

#### Scenario: Dos colaboradores modifican el mismo archivo
- **WHEN** ambos parten de la misma revisión y llegan contenidos distintos
- **THEN** conserva ambas versiones, identifica el conflicto y pide resolver antes de publicar una versión como definitiva

#### Scenario: Cambio de tarea desde dos equipos
- **WHEN** el segundo equipo intenta escribir con una revisión lógica antigua
- **THEN** el servidor rechaza o exige reconciliar sin perder la primera edición

### Requirement: Cola offline durable y aislada
El sistema SHALL conservar cambios y operaciones pendientes de forma recuperable, con reintentos idempotentes y separación por usuario/cuenta/proyecto. SHALL revalidar permisos al reconectar.

#### Scenario: Reinicio durante subida o registro
- **WHEN** se interrumpe una operación con efectos parciales
- **THEN** al reiniciar consulta el estado real y ofrece reanudar o revisar, sin duplicar ni afirmar rollback automático

#### Scenario: Revocación mientras el equipo estuvo offline
- **WHEN** el equipo vuelve con una cola pendiente y acceso retirado
- **THEN** bloquea el envío, conserva el borrador local y no recrea la membresía anterior

### Requirement: Cambios externos y cursores vencidos
El sistema SHALL reconciliar cambios externos y cursores inválidos sin borrar diferencias locales por inferencia. Detectar una ausencia de archivo no autoriza eliminar otras copias automáticamente.

#### Scenario: Cursor del proveedor deja de ser válido
- **WHEN** la sincronización incremental exige una nueva enumeración
- **THEN** se reconstruye el inventario y conserva cambios locales/conflictos antes de resolver eliminaciones

### Requirement: Capacidad, progreso y cancelación honestos
El sistema SHALL mostrar límites efectivos, progreso, cancelación, cuenta/destino y resultados parciales. Un timeout posterior a una escritura SHALL producir estado incierto cuando no pueda verificarse su efecto.

#### Scenario: Proveedor sin permiso o capacidad requerida
- **WHEN** no puede crear, compartir, hidratar o escribir de forma segura
- **THEN** informa la limitación y ofrece una modalidad comprobada sin fingir soporte

#### Scenario: Cancelar tras publicar un archivo
- **WHEN** se cancela después de confirmar la escritura remota
- **THEN** conserva el recibo de lo publicado y no informa que no se compartió nada ni borra el archivo como compensación implícita
