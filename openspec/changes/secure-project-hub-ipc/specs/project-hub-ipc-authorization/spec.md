## Purpose

Permitir operaciones Project Hub desde un caller Electron vigente y autorizado, con entradas acotadas y aprobación humana para las escrituras compartidas.

## ADDED Requirements

### Requirement: Caller cerrado y vigente
IPC MUST requerir sesión, ventana main registrada, WebContents/mainFrame exactos y documento autorizado; MUST denegar si falta esa información. MUST invalidar al cambiar sesión, navegar o destruirse y liberar listeners.

#### Scenario: Ventana no disponible
- **WHEN** no hay proveedor o la ventana registrada no existe
- **THEN** no se llama al servicio ni se expone estado/datos privados

#### Scenario: Marco o documento ajeno
- **WHEN** llama un subframe, otra ventana o documento externo
- **THEN** se deniega antes de consultar o modificar Project Hub

### Requirement: Contrato de entrada acotado
IPC MUST validar aridad, schemas estrictos del dominio y JSON acotado antes de confirmar/ejecutar. MUST capturar una copia independiente del payload aprobado y conservar los contratos válidos de los consumidores.

#### Scenario: Payload inválido o modificado después de invocar
- **WHEN** llegan campos desconocidos, cuotas excesivas o se cambia el objeto original durante la aprobación
- **THEN** el payload inválido se rechaza y la ejecución válida sólo usa su snapshot comprobado

### Requirement: Aprobación humana no transferible
Toda mutación v1 por IPC MUST pedir confirmación humana nativa con usuario, destino y alcance de datos visible. MUST NOT ejecutar tras cancelar, expirar, cambiar contexto o mientras siga abierto otro diálogo del registro. Un flag aprobado del payload MUST NOT sustituir el diálogo.

#### Scenario: Reunión dice approved=true
- **WHEN** se invoca importar reunión sin aceptar la confirmación nativa
- **THEN** no se escribe aunque el payload declare aprobación

#### Scenario: Cambio de contexto durante confirmación
- **WHEN** el usuario navega o cambia sesión incluso A/B/A antes de aceptar
- **THEN** la aceptación tardía no ejecuta ni amplía su vigencia

### Requirement: Contexto hasta HTTP y retorno
El servicio MUST revalidar autorización interna antes de enviar negocio tras una espera y usar cancelación del caller. MUST descartar datos anteriores al cambiar caller y MUST reportar incertidumbre si una mutación invocada queda sin resultado verificable. MUST NOT repetir mutaciones automáticamente.

#### Scenario: Navegación mientras se restaura sesión
- **WHEN** se aprueba una escritura y el caller navega mientras espera credenciales
- **THEN** no se envía la escritura después de terminar restore

#### Scenario: Caller desaparece tras enviar
- **WHEN** una mutación ya invocada termina después de perder su caller
- **THEN** no publica contenido previo y comunica resultado incierto sin prometer rollback

### Requirement: Integración de cuatro capas
La implementación MUST conservar los canales existentes y tipar preload/wrapper con el mismo contrato de entrada, sin publicar tokens ni contexto de autorización main al renderer.

#### Scenario: Consumidor válido
- **WHEN** el renderer envía un payload válido por su método de dominio
- **THEN** cruza el canal allowlisted existente y recibe el sobre compatible del servicio
