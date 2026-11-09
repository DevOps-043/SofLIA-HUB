## Purpose

Proteger el recorrido IPC de nodos remotos con autorización nativa, aprobación humana y límites verificables sin separar los módulos existentes.

## ADDED Requirements

### Requirement: Fuente e identidad vigentes
Los 13 canales Remote Node MUST exigir sesión main y marco principal del documento propio de Hub/Orbe registrados. MUST revalidar el contexto después de esperas y no publicar resultados privados ni actualizar metadata remota tras invalidación.

#### Scenario: Emisor no autorizado
- **WHEN** invoca un canal un emisor ajeno, subframe, documento distinto o usuario sin sesión
- **THEN** no se llama al servicio ni se muestran credenciales

#### Scenario: Contexto obsoleto
- **WHEN** cambia sesión incluso A/B/A, navegación o ventana durante una espera
- **THEN** se cancela la espera y no se admite una acción posterior ni se publica su resultado privado

### Requirement: Contratos y cuotas de entrada
Cada operación MUST validar cantidad de argumentos, campos y límites antes del servicio. MUST conservar sus canales y parámetros válidos; MUST rechazar extras, URLs con credenciales/protocolo ajeno y valores inválidos sin devolver errores crudos.

#### Scenario: Payload inválido
- **WHEN** llega un identificador, objeto, puerto, URL, tarea o comando inválido o excesivo
- **THEN** se rechaza antes de acceder al nodo o iniciar transporte

### Requirement: Aprobación vinculada a destino
Configuración, registro/borrado, ejecución/apertura remota, cierre de proceso y captura MUST exigir confirmación nativa con cancelar predeterminado y plazo acotado. MUST mostrar operación/destino/argumentos pertinentes sin token y vincular la aprobación a la configuración vigente. La confirmación renderer no sustituye este control.

#### Scenario: Cancelar o cambiar destino
- **WHEN** se cancela, vence la aprobación o cambia configuración antes del envío
- **THEN** no se realiza la operación ni se reutiliza la aprobación

#### Scenario: Efecto enviado
- **WHEN** una operación con posibles efectos pierde contexto o falla después de admitir transporte
- **THEN** se comunica incertidumbre sin reintento automático ni promesa de rollback

### Requirement: Transporte cancelable y acotado
El cliente remoto MUST tener plazo de 60 segundos para consultas/acciones breves y 15 minutos para la tarea de escritorio que espera finalización, con límite de 20 MiB de respuesta y sin seguir redirects. MUST cancelar lectura/transporte ante invalidación y preservar metadata previa cuando no puede validar la respuesta bajo contexto vigente.

#### Scenario: Respuesta excesiva o espera vencida
- **WHEN** el servidor excede el límite/plazo o redirige
- **THEN** la llamada falla de forma controlada y libera la lectura sin publicar respuesta o metadata inválidas

#### Scenario: Tarea superior a un minuto
- **WHEN** una tarea de escritorio sigue trabajando después de 60 segundos
- **THEN** conserva su espera hasta su plazo de 15 minutos, con cancelación inmediata por señal vigente
