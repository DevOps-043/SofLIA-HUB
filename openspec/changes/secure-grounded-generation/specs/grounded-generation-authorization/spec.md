## Purpose

Mantener generación con fuentes bajo identidad vigente, cancelación física y límites verificables, sin perder herramientas ya utilizadas por el producto.

## ADDED Requirements

### Requirement: Autoridad vigente
Generar y cancelar MUST exigir sesión main y documento/marco principal de Hub/Orbe registrados. Un trabajo MUST pertenecer al emisor y revisión que lo creó; cambio de sesión A/B/A, navegación o destrucción MUST cancelar y negar publicación tardía.

#### Scenario: Rechazo de autoridad
- **WHEN** invoca un emisor ajeno, subframe o cuenta sin sesión
- **THEN** no se envían datos al proveedor ni se permite cancelar el trabajo de otra ventana

### Requirement: Límites y compatibilidad
Solicitudes MUST limitarse a 320000 bytes UTF-8 y JSON acotado; sólo herramientas de búsqueda, URL y ejecución de código del proveedor bajo política local existente. HTTP MUST limitar respuesta a 8 MiB reales y plazo 150 s, rechazar redirects y admitir cuatro transportes globales y uno por emisor sin cola. Los slots MUST permanecer ocupados hasta terminar el transporte físico, aunque ignore cancelación.

#### Scenario: Stop o exceso
- **WHEN** se cancela, vence el plazo o la respuesta supera la cuota
- **THEN** se aborta transporte/lectura, no se publica respuesta tardía ni se liberan prematuramente slots físicos

### Requirement: Sin bypass ni exposición de errores
Electron MUST usar su puente autorizado y no recurrir a HTTP directo si falla o es rechazado. Navegador independiente MUST conservar transporte explícito con límites. Errores MUST ser fijos y no incluir claves, cuerpo o mensajes crudos del proveedor.

#### Scenario: Canal ausente o denegado
- **WHEN** Electron recibe rechazo o no dispone del canal
- **THEN** devuelve fallo controlado sin iniciar fetch renderer ni reintentos de autoridad

#### Scenario: Herramientas existentes
- **WHEN** una solicitud válida utiliza búsqueda/URL y gráficas según política local
- **THEN** el contrato nativo conserva esas herramientas y la extracción de texto, fuentes e imágenes
