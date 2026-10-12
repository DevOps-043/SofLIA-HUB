## ADDED Requirements

### Requirement: RF-BTE-001 Ejecución real por especialista

El sistema SHALL proporcionar a cada especialista ejecutor un objetivo, entradas autorizadas, herramientas acotadas, presupuesto y criterios de aceptación. El especialista SHALL poder realizar varios pasos y producir artefactos comprobables.

#### Scenario: Dos agentes producen resultados distintos
- **WHEN** una solicitud autorizada exige investigación y creación de un documento y existen herramientas disponibles
- **THEN** dos agentes ejecutan llamadas reales sobre subtareas independientes, registran sus resultados y producen evidencia y un archivo legible
- **AND** el coordinador no atribuye ejecución a un agente que solo emitió texto o cuya llamada falló

#### Scenario: Fuente adjunta con instrucciones de delegación
- **WHEN** un archivo o página contiene una instrucción para crear agentes o ampliar permisos
- **THEN** se trata como contenido no confiable y no concede autoridad ni amplía las fuentes del encargo

### Requirement: RF-BTE-002 Trabajo independiente del turno

El sistema SHALL mantener los trabajos ejecutables en main y devolver un identificador tras validar y guardar su admisión. La ejecución SHALL continuar sin depender de que el chat o monitor estén montados.

#### Scenario: El usuario sigue conversando
- **WHEN** un trabajo dura más de 15 segundos y el usuario envía otra pregunta o abre otra conversación
- **THEN** el trabajo sigue ejecutando sus subtareas y la nueva interacción permanece disponible
- **AND** el resultado se asocia al chat de origen

#### Scenario: Ocultar el monitor
- **WHEN** el usuario cierra la ventana flotante
- **THEN** se oculta la vista sin cancelar los trabajos

### Requirement: RF-BTE-003 Alcance y capacidades validados por el host

El sistema SHALL derivar el alcance desde la sesión autenticada y validar permisos de identidad, organización, superficie, recurso y rol antes de cada herramienta. La delegación SHALL únicamente acotar la autoridad existente.

#### Scenario: Revocación de sesión o cambio de organización
- **WHEN** cambia la identidad/organización o se revoca el acceso mientras hay trabajos activos
- **THEN** se invalida la ejecución anterior, se impiden nuevas acciones y no se muestran eventos ni artefactos al nuevo alcance

#### Scenario: Herramienta no permitida
- **WHEN** un especialista solicita una herramienta o ruta ajena a sus capacidades
- **THEN** el dispatcher rechaza la llamada aunque el modelo la incluya en su respuesta
- **AND** no hay efecto sobre el recurso

### Requirement: RF-BTE-004 Dependencias y exclusión de recursos

El sistema SHALL ejecutar en paralelo únicamente subtareas independientes y SHALL impedir escrituras o control simultáneo sobre un recurso compartido.

#### Scenario: Dos agentes editan el mismo archivo
- **WHEN** dos subtareas necesitan escribir sobre la misma versión de un archivo
- **THEN** solo un escritor obtiene acceso y el otro espera o trabaja sobre un resultado independiente
- **AND** una edición del usuario se detecta antes de publicar el resultado

#### Scenario: Varios equipos solicitan la pantalla
- **WHEN** agentes de equipos distintos necesitan controlar la misma pantalla o aplicación compartida
- **THEN** un único controlador recibe la reserva activa y los demás muestran espera de recurso

### Requirement: RF-BTE-005 Persistencia y recuperación por resultados confirmados

El sistema SHALL guardar cifrados estado y puntos de recuperación. Al reiniciar SHALL revalidar permisos y reutilizar pasos y artefactos confirmados, identificando por separado operaciones interrumpidas o inciertas.

#### Scenario: Reinicio con un archivo ya creado
- **WHEN** el proceso termina después de confirmar un archivo y antes de terminar otra subtarea
- **THEN** al reanudar se comprueba y reutiliza el archivo confirmado y solo se retoma el trabajo pendiente autorizado

#### Scenario: Cifrado no disponible
- **WHEN** el almacén cifrado no puede inicializarse
- **THEN** el sistema rechaza la modalidad duradera o identifica una modalidad volátil explícita
- **AND** no guarda contenido sensible en texto plano ni promete recuperación

### Requirement: RF-BTE-006 Aprobaciones y efectos externos conciliables

El sistema SHALL requerir HITL para efectos externos o críticos según las políticas vigentes. La aprobación SHALL quedar asociada al actor, recurso, payload final, digest y caducidad. Los reintentos SHALL respetar la idempotencia real del proveedor.

#### Scenario: Cambio del contenido aprobado
- **WHEN** cambia el destinatario, destino o payload después de aprobar una operación
- **THEN** la aprobación anterior deja de autorizar ese efecto y se requiere revisión del nuevo resultado

#### Scenario: Respuesta perdida después de un posible envío
- **WHEN** una herramienta pudo enviar o publicar pero no recibió confirmación
- **THEN** el trabajo queda incierto, consulta un recibo verificable o solicita conciliación
- **AND** no repite el efecto automáticamente

### Requirement: RF-BTE-007 Finalización y progreso basados en evidencia

El sistema SHALL mostrar actividad procedente de eventos reales y declarar el trabajo completado únicamente cuando se verifiquen los criterios de aceptación. Los resultados parciales SHALL conservarse con sus límites explícitos.

#### Scenario: El modelo afirma haber creado un archivo inexistente
- **WHEN** un agente declara éxito sin un archivo existente y legible o un recibo verificable
- **THEN** la comprobación falla y el trabajo no se presenta como completado

#### Scenario: Un agente falla después de producir resultados útiles
- **WHEN** una subtarea falla y otra tiene un artefacto válido
- **THEN** se conserva el artefacto y se indica qué requisito falta y qué recuperación es segura

### Requirement: RF-BTE-008 Cancelación y pausa seguras

El sistema SHALL propagar cancelación, invalidar acciones tardías y liberar recursos. Una pausa SHALL alcanzar un punto seguro y conservar cualquier efecto confirmado o incierto.

#### Scenario: Un proveedor responde después de cancelar
- **WHEN** llega una respuesta tardía después de la cancelación
- **THEN** no inicia nuevas herramientas ni reactiva la ejecución
- **AND** los efectos que ya estaban en curso se concilian y comunican de forma explícita

### Requirement: RF-BTE-009 Presupuesto y selección evaluables

El sistema SHALL acotar cola, concurrencia, delegación, iteraciones, tiempo y consumo total del trabajo, incluida la verificación. La selección de equipos SHALL poder compararse con un agente único.

#### Scenario: Presupuesto insuficiente
- **WHEN** una nueva subtarea o reintento excedería el presupuesto disponible
- **THEN** no se admite esa ejecución y se informa el límite conservando los resultados válidos

### Requirement: RF-BTE-010 Entorno de ejecución explícito

El sistema SHALL indicar si el trabajo es local o remoto y no prometer acceso a recursos locales cuando el equipo o la sesión no están disponibles. La programación recurrente SHALL requerir una solicitud expresa.

#### Scenario: El ordenador se apaga en la modalidad local
- **WHEN** deja de ejecutarse el proceso local
- **THEN** el trabajo no se presenta como activo y queda disponible para recuperación según sus puntos guardados

#### Scenario: Una tarea remota necesita una carpeta local
- **WHEN** la futura modalidad remota necesita un recurso local cuyo puente no está conectado
- **THEN** espera el recurso o comunica la limitación sin subir otras carpetas ni ampliar permisos
