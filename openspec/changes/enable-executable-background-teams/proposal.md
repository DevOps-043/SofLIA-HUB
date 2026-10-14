# Equipos ejecutores de SofLIA en segundo plano

Estado: fase local implementada; coordinación ampliada y continuidad remota pendientes. Fecha: 2026-10-11.

## Capacidad implementada

La fase local ya dispone de dos ejecutores y un coordinador en Electron main,
cola y persistencia cifrada, presupuestos, cancelación/pausa/reanudación y
verificación de archivos. Las herramientas disponibles leen contexto y aportes,
crean Markdown/texto/CSV/Word, Excel y PowerPoint, y realizan investigación pública
cuando el encargo la autoriza. El coordinador lee los archivos reales; el chat
muestra operaciones, resultado y todos los entregables comprobados.

Los envíos, integraciones con efectos externos, control de pantalla compartida,
programación y ejecución remota siguen reservados a las fases siguientes. Las
secciones de ampliación de esta propuesta describen ese diseño futuro, sin
atribuirlo al runtime actual. La evidencia vigente está en [verificación](reports/verification.md).

## Why

El usuario necesita que los multiagentes realicen trabajo mientras continúa usando el chat: consultar fuentes, crear documentos, preparar archivos y ejecutar operaciones autorizadas. La participación visible debe corresponder a acciones y resultados reales.

La ampliación anterior se diseñó expresamente con especialistas sin herramientas. Actualmente prepara dos aportes, con una llamada por especialista y un límite de 15 segundos, antes de que responda el coordinador. Esa arquitectura ayuda a analizar, pero no permite delegar una tarea operativa completa. El [diagnóstico y la investigación oficial](reports/research.md) documentan la diferencia.

## What Changes

SofLIA conservaría la conversación y la responsabilidad de entregar el resultado. Para solicitudes que requieran ejecución, crearía un trabajo con subtareas, dependencias, herramientas y criterios de aceptación. Un servicio en Electron main mantendría la ejecución aunque el usuario cambie de chat u oculte el monitor.

Se propone incorporar:

1. **Agentes ejecutores.** Cada agente dispone de un ciclo de observar, decidir, invocar una herramienta permitida y comprobar el resultado. Puede producir archivos y usar integraciones autorizadas; su salida no se limita a una opinión.
2. **Equipos por capacidad.** Investigador, creador de documentos, operador de archivos, operador de integración y verificador son perfiles disponibles. SofLIA activa únicamente los necesarios y ejecuta en paralelo las subtareas independientes.
3. **Trabajos persistentes.** Cola, estado cifrado, puntos de recuperación, cancelación y presupuesto compartido. El trabajo devuelve inmediatamente un identificador y permite continuar la conversación.
4. **Entregables comprobados.** Los archivos tienen propietario, versión y evidencia de creación. Un verificador abre el resultado y comprueba los requisitos antes de declarar terminada la tarea.
5. **Monitor operativo.** La ventana flotante muestra qué agente está haciendo qué, qué herramienta terminó, qué archivos existen y qué decisión necesita al usuario. Incluye acceso al resultado y controles de tarea.
6. **Ejecución gobernada.** Permisos por identidad, organización, recurso y rol; una sola escritura por archivo y un solo controlador por pantalla compartida. Aprobación concreta antes de efectos externos o críticos.

### Ejemplo aplicado a Rethink & Delight

Solicitud: «Prepara tres activaciones diferentes, investiga referencias, crea un presupuesto y una presentación. Guarda los resultados y sigue trabajando mientras te hago otras preguntas».

| Agente | Trabajo ejecutable | Resultado comprobable |
| --- | --- | --- |
| Investigador | Consulta fuentes autorizadas y conserva referencias | Dossier con enlaces y evidencia |
| Creativo | Desarrolla las tres alternativas y escribe el documento | Archivo con conceptos, dinámica y requisitos |
| Presupuesto | Usa los conceptos y los datos disponibles para construir los costes | Hoja de cálculo con fórmulas; supuestos identificados |
| Presentación | Compone el material a partir del contenido y presupuesto aceptados | Archivo de presentación o formato disponible declarado |
| Verificador | Abre los resultados y comprueba archivos, cálculos y referencias | Informe de comprobación y correcciones |

Los perfiles no implican cinco agentes simultáneos: presupuesto y presentación dependen de resultados previos. Si faltan precios, se identifican como pendientes o estimaciones; si falta una herramienta de exportación, se comunica el formato disponible.

### Prioridad de implementación

| Fase | Entrega | Condición para avanzar |
| --- | --- | --- |
| 1. Ejecución local | Servicio en main, persistencia básica, dos ejecutores, herramientas de investigación y archivos, chat libre y monitor | Dos agentes crean resultados reales, se comprueban y se recupera una interrupción sin repetir trabajo terminado |
| 2. Coordinación y operaciones | Más perfiles, dependencias, exclusión de recursos, integraciones y aprobaciones persistentes | Sin colisiones ni duplicados; evidencia de calidad frente a un agente único |
| 3. Continuidad ampliada | Tareas programadas bajo solicitud expresa y ejecución remota para trabajos compatibles | Host remoto, permisos, retención, costes y acceso local definidos y probados |

La primera fase ya ejecuta tareas y entrega archivos. La tercera es necesaria para trabajar con Soflia Hub cerrado o el ordenador apagado. En la fase local, cerrar el proceso interrumpe la ejecución y deja un punto de recuperación.

## Capabilities

### New Capabilities

- `executable-background-teams`: trabajos delegados con herramientas, estado persistente, artefactos y verificación.

### Modified Capabilities

Ninguna en esta propuesta documental. La futura implementación adaptará el inicio del chat y la actividad visible conservando el flujo de análisis breve y el arnés de reuniones durante la transición.

## Impact

Futuro servicio y repositorio de trabajos en main; adaptación de proveedores y ejecutores de herramientas; contratos tipados en shared, handler, preload y renderer; integración con chat y monitor. Reutilizar servicios existentes mediante adaptadores con guardas. No añadir un SDK obligatorio, un proveedor nuevo ni una base remota en la primera fase.

El [diseño](design.md) define las decisiones y límites; la [especificación](specs/executable-background-teams/spec.md) fija los escenarios de aceptación; las [tareas](tasks.md) separan investigación completada de implementación pendiente. La [evidencia documental](reports/verification.md) registra exclusivamente las validaciones ejecutadas.
