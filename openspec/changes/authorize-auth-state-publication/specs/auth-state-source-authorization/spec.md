## Purpose

Restringir la publicación y lectura del estado de autenticación a las ventanas y documentos nativos registrados, preservando la restauración inicial y la confidencialidad de credenciales.

## ADDED Requirements

### Requirement: Roles de publicación y lectura
El sistema MUST aceptar publicaciones sólo del marco principal del Hub registrado y lecturas del Hub u Orbe registrados, desde el documento propio. La autorización MUST funcionar antes de iniciar sesión y preceder al procesamiento del payload y los efectos. Una fuente denegada MUST recibir un estado sin identidad ni credenciales.

#### Scenario: Restauración inicial legítima
- **WHEN** el Hub registrado publica desde su documento principal sin sesión previa
- **THEN** se procesa el contrato conservando las verificaciones de identidad existentes

#### Scenario: Orbe consumidor y fuentes ajenas
- **WHEN** el Orbe intenta publicar o un emisor ajeno, subframe, marco ausente o documento remoto intenta publicar o leer
- **THEN** se deniega sin invocar servicios ni revelar la identidad actual

#### Scenario: Lectura legítima
- **WHEN** Hub u Orbe registrados leen desde su documento principal
- **THEN** reciben exclusivamente authenticated y userId

### Requirement: Contrato acotado y credenciales de ida
El sistema MUST aceptar sólo las siete claves existentes, un booleano authenticated, IDs opcionales de hasta 128 unidades UTF-16 y tokens opcionales opacos de hasta 65536 unidades cada uno, sin caracteres de control y en pares completos o ausentes. Un payload inválido de fuente autorizada MUST conservar el estado y no invocar servicios. La revocación válida MUST normalizar identidad, organización y credenciales a ausencia. Ninguna respuesta o diagnóstico MUST contener tokens ni errores libres del proveedor.

#### Scenario: Rechazo antes de efectos
- **WHEN** llegan tipos erróneos, campos desconocidos, controles, IDs o tokens excesivos o pares parciales
- **THEN** la publicación falla sin alterar estado, organización o sesiones

#### Scenario: Compatibilidad de publicaciones válidas
- **WHEN** llega una publicación válida con pares completos, sin tokens o un cierre
- **THEN** conserva la política de verificación SOFIA y compatibilidad sin SOFIA, y devuelve sólo un snapshot observable

#### Scenario: Credenciales SOFIA rechazadas
- **WHEN** se publica un par SOFIA y main no verifica la identidad declarada
- **THEN** devuelve `ok: false` con estado sin identidad y no aplica Lia ni inicia el canje de Project Hub

#### Scenario: Renovación de la sesión SOFIA en main
- **WHEN** la verificación de SOFIA renueva el token de acceso de la misma identidad
- **THEN** el canje Project Hub usa el token resultante y la respuesta IPC sólo incluye el estado observable

#### Scenario: SOFIA confirma la revocación de una sesión persistida
- **WHEN** Supabase Auth confirma que la sesión publicada ya no existe
- **THEN** el renderer invalida la identidad vigente y vuelve al inicio de sesión
- **AND** un rechazo genérico o una respuesta de una publicación anterior no revoca la identidad del renderer

#### Scenario: Limpieza de la copia nativa durante el arranque
- **WHEN** una publicación sin identidad retira las copias de SOFIA y Lia de main
- **THEN** se detienen los clientes de main y se limpian sus credenciales locales sin revocar la sesión compartida en Supabase
- **AND** una aplicación de Lia anterior a esa limpieza no vuelve a escribir la credencial

### Requirement: Vigencia de la fuente durante esperas
El sistema MUST invalidar una publicación pendiente cuando navega el documento principal, se pierde el proceso, se destruye o reemplaza su ventana o marco. Al regresar de cada espera MUST comprobar la fuente y la revisión antes de siguientes efectos o respuestas exitosas. Los recursos de observación MUST liberarse al finalizar o rechazar.

#### Scenario: Navegación y retorno
- **WHEN** una fuente navega, incluso si vuelve al mismo documento, mientras un servicio está pendiente
- **THEN** su respuesta no autoriza efectos siguientes ni publica un resultado exitoso para el nuevo documento

#### Scenario: Publicación posterior
- **WHEN** un cierre o publicación posterior sustituye a otra pendiente
- **THEN** la respuesta anterior no sobrescribe el estado posterior

#### Scenario: Fallo de servicio
- **WHEN** un servicio falla durante una publicación autorizada
- **THEN** la respuesta es controlada, los listeners se liberan y no se divulga el error del proveedor

La invalidación no promete cancelar o revertir I/O ya admitido ni rediseñar la persistencia interna de los SDK.
