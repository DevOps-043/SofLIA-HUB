## ADDED Requirements

### Requirement: Contrato runtime obligatorio

El sistema SHALL registrar una herramienta dinámica ejecutable únicamente si
declara propietario, riesgo, agentes permitidos, política HITL, disponibilidad
en grupos, timeout, auditoría y esquemas cerrados de entrada y salida.

#### Scenario: Herramienta gobernada válida
- **WHEN** el loader encuentra una herramienta con contrato completo y válido
- **THEN** la registra y expone su política en el inventario runtime

#### Scenario: Herramienta legacy incompleta
- **WHEN** un archivo ejecutable omite el contrato runtime o el esquema de salida
- **THEN** el loader rechaza el archivo y no expone ni ejecuta su herramienta

### Requirement: Validación cerrada de entrada y salida

El sistema MUST compilar los contratos JSON Schema admitidos a esquemas Zod
estrictos y SHALL validar los argumentos antes del handler y el resultado antes
de devolverlo al agente.

#### Scenario: Argumento adicional
- **WHEN** una llamada contiene una propiedad no declarada en el esquema de entrada
- **THEN** el sistema rechaza la llamada sin invocar el handler

#### Scenario: Resultado fuera de contrato
- **WHEN** el handler devuelve un valor que no satisface el esquema de salida
- **THEN** el sistema falla la llamada, registra el resultado como error y no entrega el valor inválido

### Requirement: Denegación por contexto

El ejecutor central MUST denegar una llamada si el agente no está permitido, el
chat grupal no está habilitado o una acción con HITL requerido no trae aprobación
humana emitida por el host.

#### Scenario: Agente no permitido
- **WHEN** un agente que no aparece en `allowedAgents` solicita la herramienta
- **THEN** el ejecutor devuelve denegación antes de invocar el handler

#### Scenario: Grupo bloqueado
- **WHEN** una herramienta con `allowInGroups: false` se solicita desde un grupo
- **THEN** el ejecutor deniega la llamada aunque el nombre exista en el registro

#### Scenario: HITL ausente
- **WHEN** una herramienta con `hitl: required` llega sin aprobación humana
- **THEN** el ejecutor devuelve `approval_required` y no invoca el handler

#### Scenario: Confirmación WhatsApp válida
- **WHEN** un usuario autorizado confirma por WhatsApp una herramienta dinámica con HITL
- **THEN** el dispatcher transmite esa decisión fuera de los argumentos y el ejecutor permite una única llamada gobernada

#### Scenario: Contrato recargado después de confirmar
- **WHEN** nombre, descripción, schema o política cambian entre el preflight y la ejecución
- **THEN** el ejecutor devuelve `contract_changed`, no invoca el handler y exige una autorización nueva

### Requirement: Ejecución acotada y cancelable

El sistema SHALL imponer el timeout declarado dentro de límites seguros y MUST
propagar un `AbortSignal` al handler dinámico.

#### Scenario: Timeout excedido
- **WHEN** el handler no termina dentro de su timeout
- **THEN** el sistema aborta la señal, devuelve un error `timeout` y libera la espera del agente

### Requirement: Auditoría trazable y minimizada

El sistema SHALL emitir un registro por cada intento con `traceId`, herramienta,
propietario, riesgo, agente, resultado, duración y código de error, y MUST NOT
incluir argumentos, resultados, identidad personal ni secretos.

#### Scenario: Ejecución exitosa
- **WHEN** una herramienta termina y su resultado valida
- **THEN** el sistema emite un evento `success` correlacionado por `traceId`

#### Scenario: Ejecución denegada
- **WHEN** permisos, grupo o HITL bloquean una llamada
- **THEN** el sistema emite un evento `denied` sin ejecutar el handler ni registrar su payload

#### Scenario: Inventario y operaciones sin rutas locales
- **WHEN** el agente lista, diagnostica, instala o desinstala toolsets
- **THEN** la respuesta incluye scopes y nombres de archivo pero no rutas absolutas del host

### Requirement: Separación del arnés de desarrollo

El registro runtime MUST aceptar solo contratos de herramienta del producto y
MUST NOT descubrir ni publicar automáticamente skills, prompts o adaptadores de
`ai-specs/`, `.codex/`, `.claude/` o `.agents/`.

#### Scenario: Skill de desarrollo presente
- **WHEN** el repositorio contiene una nueva skill del arnés
- **THEN** el inventario de herramientas dinámicas permanece sin cambios hasta que exista un contrato runtime explícito en un directorio configurado
