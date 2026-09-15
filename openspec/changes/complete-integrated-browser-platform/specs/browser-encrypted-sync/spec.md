## Purpose

Sincroniza datos no secretos del navegador entre dispositivos con cifrado de extremo a extremo y control selectivo del usuario.

## ADDED Requirements

### Requirement: Sincronización selectiva cifrada
El usuario SHALL elegir si sincroniza marcadores, grupos, pestañas y ajustes. Los datos SHALL cifrarse antes de salir del dispositivo y el servidor MUST NOT recibir claves de descifrado.

#### Scenario: Sin proveedor configurado
- **WHEN** el usuario intenta activar sync sin backend o clave válidos
- **THEN** no se envía ningún dato y se explica la configuración faltante

#### Scenario: Activación y primera base
- **WHEN** el titular configura categorías y solicita sincronización sin una base compartida conocida
- **THEN** el controlador exige revisión nativa y elección inicial antes de aplicar; los adaptadores validan contexto y cambios locales, sin sustituir la base por vacío

#### Scenario: Reapertura sin eco
- **WHEN** el cliente vuelve a abrir después de un commit remoto/local confirmado
- **THEN** reutiliza checkpoints protegidos y no publica otra escritura para datos sin cambios; una revocación impide nuevas transferencias

#### Scenario: Recuperación de configuración sin reactivar transferencia

- **WHEN** el titular solicita recuperar configuración local ausente o dañada
- **THEN** main exige copia compatible y confirmación nativa, conserva el original protegido y publica categorías vacías y fecha de última ejecución nula, sin contactar Auth/servidor ni restaurar dispositivos, claves, checkpoints o decisiones pendientes
- **AND** versiones futuras, ámbito ajeno, cuota, revisión vencida o cancelada conservan los archivos sin reemplazarlos

#### Scenario: Recuperación de clave por archivo
- **WHEN** el titular exporta o importa su clave de sincronización
- **THEN** main usa archivos elegidos y confirmación nativa, no expone código, clave o ruta al renderer y rechaza reemplazar una clave existente; pausar no borra claves ni deshace escrituras remotas

#### Scenario: Contrato remoto personal
- **WHEN** el titular registra un dispositivo con una sesión Supabase Auth Lia verificable
- **THEN** el registro queda ligado al usuario y al `session_id` firmado; RLS sólo permite leer filas propias desde sesiones registradas no revocadas, sin acceso anónimo ni escrituras directas

#### Scenario: Escritura repetida o concurrente
- **WHEN** se escribe un envelope permitido con revisión base, idempotency_key y trace_id
- **THEN** un replay exacto devuelve la revisión original, una clave reutilizada con otro contenido falla y una base obsoleta informa conflicto sin sobrescribir

#### Scenario: Reversión operativa del esquema
- **WHEN** se deshabilita el contrato mediante su rollback no destructivo
- **THEN** se revocan lecturas y RPC de los clientes sin borrar envelopes, recibos ni dispositivos

### Requirement: Conflictos y revocación
La sincronización SHALL detectar versiones concurrentes, resolver tipos con reglas deterministas, conservar conflictos no resolubles y permitir revocar dispositivos.

#### Scenario: Cambios compatibles sobre una base común
- **WHEN** los dispositivos modifican campos distintos o agregan IDs distintos desde una instantánea base explícita
- **THEN** se combinan los cambios con orden estable, sin usar el reloj del dispositivo como ganador; etiquetas se combinan como conjuntos respetando bajas y cuotas

#### Scenario: Diferencia que requiere decisión
- **WHEN** ambos lados cambian un campo de forma distinta, colisionan en un ID nuevo, o borran y editan simultáneamente
- **THEN** se conservan base y ambas variantes; no se entrega un payload aplicable hasta resolver todos los conflictos con elecciones ligadas a esa revisión

#### Scenario: Pendiente después de reiniciar
- **WHEN** se prepara o resuelve una revisión y el proceso vuelve a abrir su diario
- **THEN** el archivo protegido por el almacén del SO conserva instantáneas y decisiones por perfil; corrupción, cuota o fallo de reemplazo no se convierten en éxito ni borran el archivo anterior

#### Scenario: El servidor vuelve a cambiar durante la revisión
- **WHEN** una revisión completamente resuelta recibe una versión remota posterior tras un conflicto CAS
- **THEN** se usa la versión remota anterior como nueva base y el resultado resuelto como lado local; se genera otra revisión y no se aceptan decisiones ligadas a la anterior

#### Scenario: Dispositivo revocado
- **WHEN** el usuario revoca un dispositivo
- **THEN** sus credenciales de sync dejan de aceptar lecturas o escrituras nuevas

#### Scenario: No reactivar sesión revocada
- **WHEN** una sesión revocada intenta registrar otro ID de dispositivo o repetir una escritura antes aprobada
- **THEN** el servidor lo rechaza; una nueva autenticación y activación explícita serán necesarias, sin prometer retirar copias ya descargadas

### Requirement: Gestión de dispositivos con consentimiento
El registro y la revocación SHALL requerir consentimiento nativo desde el marco principal autenticado y una sesión Lia verificada. Main MUST rechazar contextos obsoletos y no exponer tokens ni identificadores directos del equipo.

#### Scenario: Registro con consentimiento
- **WHEN** el titular confirma registrar este dispositivo desde el marco principal con sesión Lia verificada
- **THEN** main persiste un ID aleatorio protegido antes de registrar y lo reutiliza al reintentar, sin enviar hostname, MAC ni claves E2EE

#### Scenario: Operación cancelada o sustituida
- **WHEN** se cancela, cambia el perfil o termina la ventana durante una solicitud o confirmación
- **THEN** se aborta la solicitud local y se rechazan decisiones/respuestas obsoletas; se advierte que no se deshacen escrituras ya recibidas por el servidor

#### Scenario: Backend no disponible
- **WHEN** falta configuración, la sesión no es válida, las RPC no están desplegadas o vence la respuesta
- **THEN** no se anuncia éxito y la UI permite consultar de nuevo sin exponer cuerpos, rutas ni tokens

### Requirement: Exclusión de secretos
La primera versión MUST NOT sincronizar contraseñas, passkeys, cookies, tokens, datos de pago ni valores de formulario.

#### Scenario: Payload contiene categoría prohibida
- **WHEN** un cliente intenta sincronizar un tipo secreto
- **THEN** el contrato lo rechaza antes de cifrar o transmitir

### Requirement: Recuperación coordinada del estado local
El controlador SHALL recuperar checkpoints y diario dañados o incoherentes con confirmación nativa, contexto humano vigente y exclusión de operaciones. MUST conservar los originales protegidos, pausar categorías y descartar decisiones/envíos antiguos, sin contactar al servidor ni modificar claves o dispositivos.

#### Scenario: Reconstrucción confirmada
- **WHEN** la configuración identifica al titular y el estado derivado está dañado o es incoherente
- **THEN** una confirmación vigente reconstruye checkpoints y diario vacíos; reactivar exige revisión inicial nueva y no reproduce envíos anteriores

#### Scenario: Fallo entre reemplazos
- **WHEN** falla la recuperación después de publicar el marcador protegido y antes de completar los tres archivos
- **THEN** el marcador persiste y bloquea las operaciones ordinarias, incluso tras reiniciar; el usuario puede confirmar la reversión local

#### Scenario: Reversión segura
- **WHEN** se confirma revertir y cada archivo coincide con su original o con la proyección de esa operación
- **THEN** se restauran bytes y ausencias originales antes de retirar el bloqueo; se advierte que puede regresar la corrupción original y que no se deshacen cambios remotos

#### Scenario: Contexto o evidencia incompatible
- **WHEN** cambian sesión, perfil, control, bytes, esquema, ámbito o vence la revisión, o el marcador es ilegible
- **THEN** se rechaza la operación sin sobreescribir evidencia ni eliminar automáticamente el bloqueo
