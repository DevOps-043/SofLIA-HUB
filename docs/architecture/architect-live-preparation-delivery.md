# Entrega de preparación síncrona de Architect al estudio de Hub

**Estado** — Dos entregas implementadas localmente para el curso híbrido. Pendientes archivos, medios, registro real y piloto. Revisión del 17 de noviembre de 2026.

La [primera revisión visual del 18 de noviembre](../../openspec/changes/extend-live-session-preparation/reports/visual-review.md) alinea edición y entrega en Architect y plan/documentos en Hub con los tokens de cada producto. Su evidencia utiliza componentes reales y datos sintéticos; el recorrido autenticado completo sigue pendiente.

La segunda entrega estructura los 14 documentos, genera instrumentos y contingencias y registra la aplicabilidad de ayudas, refuerzo y ausencia. Academy conserva los documentos privados y permite al instructor publicar al grupo únicamente sus secciones públicas. Los clientes negocian la ampliación mediante X-Soflia-Studio-Documents. La ruta firmada de preparación admite 256 KiB y las operaciones habituales del aula conservan 32 KiB.

La [ruta coordinada de ampliaciones](../../openspec/changes/extend-live-session-preparation/roadmap.md) organiza las entregas por plataforma. La primera ampliación local incluye bloques, tiempos y notas privadas del ponente. Las tareas y la evidencia de verificación se mantienen en ese cambio.

## Alcance corregido

Architect (CourseForge, también llamado Engine en el código) produce el curso híbrido. El alumno realiza las lecciones asíncronas en **SofLIA Learning**. El instructor imparte las sesiones programadas en el **estudio de Hub**. Para cada sesión, Architect selecciona y entrega los recursos de apoyo aprobados. Las primeras familias candidatas son diapositivas, guion para teleprompter y clips de apoyo (B-roll).

Una sesión en vivo tiene un destino concreto en Learning, identificado por organización, curso y sesión. La entrega se vincula a ese destino y a una revisión de origen. La creación y publicación del curso asíncrono siguen su flujo académico en Learning.

**Alcance confirmado** — Las lecciones asíncronas se cursan en Learning y las sesiones síncronas se imparten y se toman en el estudio de Hub. Learning muestra la programación y el acceso a cada sesión en vivo desde el recorrido del curso. La API de esta propuesta entrega únicamente la preparación de esa sesión.

## Qué significaban las opciones 2 y 3

| Opción anterior | Experiencia del alumno | Trabajo que agrega | Aplicación al curso híbrido |
| --- | --- | --- | --- |
| 2. Estado y catálogo en Hub, estudio en Learning | El alumno ve el curso en Hub y abre Learning para ver lecciones, responder evaluaciones y registrar progreso. | Lecturas de catálogo y estado, permisos, UI y navegación. | Sirve como patrón de consulta de estado. El catálogo de asíncronos en Hub es prescindible para entregar la preparación en vivo. |
| 3. Experiencia de estudio nativa en Hub | El alumno completa esas mismas lecciones asíncronas dentro de Hub. Learning sigue siendo la autoridad académica. | Todo el trabajo de acceso, más interfaces y APIs para lecciones, medios, evaluaciones y progreso. Incluye reanudación, fallos de guardado y compatibilidad funcional. | Amplía el alcance a otro producto. El estudio en vivo de Hub ya existe y cumple otra función. |

Ambas opciones describían dónde consume el alumno las lecciones asíncronas. El transporte de la preparación en vivo es una decisión aparte. La solución recomendada reutiliza el patrón de confirmación de la opción 2 y el estudio síncrono que Hub ya tiene.

## Punto de partida de la ampliación

1. **Architect selecciona el destino.** El servicio consulta sesiones para la organización activa y exige la revisión vigente y materiales aprobados. Envía por HTTPS una solicitud firmada al endpoint interno de preparación de Learning, con actor, artefacto, sesión de origen, revisión y destino. El cuerpo JSON tiene un límite de 32 KiB. Architect comprueba que la respuesta confirme la sesión y la revisión solicitadas.
2. **El paquete actual es acotado.** El constructor traduce las diapositivas a escenas con título y viñetas, y las actividades a prácticas con consigna y plantilla. Aunque el contrato contempla escenas de imagen/video y referencias a archivos, el constructor envía escenas de texto, omite las notas del facilitador y deja vacías las listas de materiales y cuestionarios. El esquema admite hasta 12 escenas y 20 prácticas. Una presentación renderizada, un guion de teleprompter y un B-roll requieren extender la entrega.
3. **Learning aplica autoridad y conserva el estado; Hub consume el estudio.** El cambio coordinado documenta validación de instructor, organización, curso y sesión, y guardas de revisión y de estado. El snapshot de estudio expone la revisión de Engine y las referencias de los recursos visibles para el actor. El servicio de estudio inspeccionado firma enlaces temporales a esos recursos. Hub ya puede representar escenas con texto, imagen o video. Mostrar un video en la vista previa y emitirlo en el programa audiovisual son verificaciones distintas.
4. **Estado de la evidencia.** El checkout de Academy revisado durante la implementación contiene la ruta interna de preparación y la ruta autenticada del estudio. La ampliación local agrega lectura de bloques y notas privadas negociada por cabecera. La entrega real a un aula sigue pendiente del piloto. [Entrega de QA y recorrido mínimo](../operations/synchronous-testing-release.md) · [Evidencia local de la ampliación](../../openspec/changes/extend-live-session-preparation/reports/verification.md)

## Transporte recomendado

| Alternativa | Evaluación |
| --- | --- |
| **Architect → Learning → estudio de Hub** | Reutiliza la entrega firmada y el snapshot. Learning asocia recursos y revisión a la sesión, comprueba permisos y autoriza la lectura. Funciona con Hub cerrado al entregar y permite que otro equipo autorizado prepare el aula. |
| Architect → Hub directo | Requeriría receptor de escritorio o un servicio adicional, persistencia y recuperación de entregas pendientes, además de resolver autorización y consistencia con Learning. |
| Exportación e importación manual | Hub ya expone una acción de importación de manifiesto. Es una opción operativa para pruebas controladas. Depende de una persona para mover y verificar cada revisión y resolver sus archivos. |

Separar **manifiesto y archivos**. Architect envía metadatos pequeños y versionados. Los archivos se transfieren a almacenamiento privado bajo control de Learning, mediante una autorización de carga acotada o transferencia controlada entre servidores. El manifiesto referencia IDs de archivos registrados. Learning verifica que correspondan al destino y emite URLs temporales al usuario autorizado. El estado de estudio conserva referencias estables. Los reintentos conservan la misma identidad de entrega.

## API y entregas de implementación

La escritura vive en el servidor de Learning. Architect es el productor del paquete y Hub es el cliente autenticado que lo carga al abrir el aula. Learning conserva la programación, las asignaciones, los roles y la relación con el recorrido del curso. Los bytes de un video pueden viajar por separado al almacenamiento autorizado bajo el mismo control de acceso.

| Entrega | Contrato y comportamiento | Cómo se acepta |
| --- | --- | --- |
| 1. Entrada de preparación y confirmación | Reusar la operación firmada Architect → Learning para una sesión programada. Identificar organización, curso y sesión de destino, artefacto y sesión de origen, revisión del contenido, versión del contrato y huella del paquete. Learning verifica al actor y persiste la preparación con un identificador y una revisión aplicable al estudio. | Entregar láminas de texto y prácticas con Hub cerrado. Repetir una solicitud cuya respuesta se perdió y obtener la misma confirmación. Denegar un destino ajeno y rechazar contenido distinto con la misma identidad de revisión. |
| 2. Acceso desde el curso y lectura en Hub | Learning muestra la sesión, su horario y la acción **Abrir en Hub** según acceso y estado. Reusar el enlace de apertura con referencia a organización y sesión. Hub comprueba la sesión por el flujo existente y consulta el snapshot autorizado con identidad del usuario. El estudio del instructor indica la revisión cargada. | Desde un curso de QA, abrir la sesión correcta en Hub como instructor y participante. Probar Hub cerrado, usuario sin acceso y organización incorrecta. El enlace transporta referencias y Learning aplica la autorización al abrir. |
| 3. Archivos de sesión | Añadir registro y carga privada de recursos vinculados a la entrega. El manifiesto tipado identifica cada recurso, su posición o uso y su audiencia. Learning confirma la revisión aplicable cuando todos los recursos obligatorios están validados. | Entregar una diapositiva renderizada y un clip, renovar acceso a medios y comprobar vista previa y emisión en el aula. Un archivo fallido deja disponible la última revisión válida. |
| 4. Guion privado del instructor | Agregar lectura específica del guion, o una proyección exclusiva del instructor fuera del estado compartido. Hub lo muestra en el teleprompter según el permiso vigente. | Un instructor autorizado ve el guion. La cuenta de alumno carece de acceso al texto y a sus referencias. Verificar además la salida audiovisual, grabación y comportamiento al compartir pantalla. |

Para la primera entrega, el acuse de Learning distingue **registrada** de **aplicada al estudio** cuando ambas operaciones ocurren en momentos distintos. Hub obtiene **preparación cargada** de su lectura efectiva de la revisión, y **lista** cuando los recursos obligatorios están disponibles. La opción de un enlace al aula desde el curso se valida por separado de la carga de preparación. El acceso a una sesión se decide con su programación y permisos académicos. [Contrato existente de apertura Learning → Hub](../../openspec/changes/launch-learning-live-sessions/integration.md)

Las ampliaciones de archivos y guion se negocian por versión del contrato y se activan después de comprobar qué pueden consumir los clientes instalados. Antes de fijar sus campos definitivos, acordar si la diapositiva debe preservar el diseño, cómo se usa el audio del B-roll y si el guion se organiza por sesión o por diapositiva.

### Recursos y visibilidad

| Recurso | Punto de partida | Alcance recomendado |
| --- | --- | --- |
| Diapositivas | Láminas estructuradas de título y viñetas. | Mantener ese formato en el primer recorrido. Si debe conservarse el diseño de Architect, probar diapositivas renderizadas como imágenes con orden estable y validar su legibilidad en Hub y en la salida en vivo. |
| Guion para teleprompter | Architect tiene notas de facilitador que el envío actual omite. | Definir y aprobar un guion de sesión explícito. Entregarlo por una lectura exclusiva para el instructor autorizado y presentarlo en un panel privado. Mantenerlo fuera del snapshot del participante, las escenas emitidas y las grabaciones de prueba. |
| B-roll | Hub representa escenas de video con una URL autorizada. El envío desde Architect aún no aporta el archivo. | Probar un clip con acción explícita del instructor. Definir formato, duración, tamaño y política de audio. Verificar por separado vista previa y emisión real en el programa audiovisual. |
| Otros documentos y datos | El contrato contempla materiales y prácticas. | Incorporarlos por tipo, uso y audiencia cuando se acuerde cuáles forman parte de una sesión. |

### Confirmación y validaciones

- **Architect** muestra **Preparación aprobada**, **Enviando** y **Recibida por Learning** con sesión y revisión confirmadas. Si la respuesta se pierde, consulta o reintenta con la misma identidad. Un conflicto de revisión requiere actualizar el destino antes de intentar otro envío.
- **Hub** muestra en el estudio del instructor la revisión cargada y los recursos disponibles o pendientes. **Lista para preparar** requiere el manifiesto aplicado y los recursos obligatorios accesibles. La emisión es una acción del instructor, independiente de la entrega.
- **Learning** verifica identidad de integración y docente, organización, curso, sesión, revisión vigente y estado de la sesión. Debe comprobar formato, tamaño, integridad y pertenencia de cada archivo. La misma revisión con contenido diferente genera conflicto. Una entrega incompleta conserva la preparación anterior y permite recuperar el envío sin duplicarla.
- **Actualizaciones** requieren una regla explícita sobre el destino de ajustes locales, escenas y materiales existentes. El comando actual de importación sustituye colecciones del estudio. Antes de habilitar reenvíos, comprobar el comportamiento de una revisión nueva y bloquear reemplazos incompatibles con una sesión en curso o con actividad iniciada.

## Contraste de los entregables con Architect

La revisión del código de generación y exportación contrasta los 14 entregables de las capturas aportadas por el equipo. «Parcial» significa que hay campos o una salida relacionada, pero su contrato aún requiere ampliación para satisfacer lo descrito. El código permite verificar la estructura y las reglas de generación; la calidad de una salida real requiere revisión de contenido en QA. Academy es el nombre de producto indicado en la reunión para Learning. Las rutas y los identificadores técnicos conservan Learning.

| Entregable acordado | Cobertura observada en Architect | Trabajo necesario |
| --- | --- | --- |
| 1. Plan instruccional del curso | Parcial. Hay un dominio de plan instruccional por lección y coordinación con la rama híbrida. La agenda síncrona se genera desde el temario aprobado. | Incorporar al contrato síncrono el plan global aprobado con resultados, evidencias, progresión y duración. Verificar que la agenda depende de esa revisión. |
| 2. Agenda general de sesiones | Implementada con título, minutos, objetivos, cobertura curricular y evidencia por sesión. | Contrastar prerrequisitos y actividades principales exigidos por el documento. Conservar la aprobación del plan global como dependencia explícita. |
| 3. Plan detallado por sesión | Parcial. Hay bloques ordenados con ID, propósito, minutos, explicación, actividad, criterios y recursos. Se valida la suma de tiempos. | Vincular cada recurso mediante ID y definir productos esperados, evidencias y tipos de bloque cuando corresponda. |
| 4. Instrumentos de evaluación y retroalimentación | Parcial. Las actividades tienen consigna, plantilla, respuesta razonada y criterios. | Estructurar instrumentos, rúbricas o listas de cotejo, errores críticos, retroalimentación y reintentos según el instrumento. |
| 5. Material del participante | Hay una proyección pública y exportación HTML con conceptos, ejemplos, actividades y plantillas. | Completar identificadores de recursos, momento de uso, tiempos, producto esperado y referencias al bloque. |
| 6. Presentación con notas del ponente | Hay láminas con título, viñetas, notas y fuentes, exportables como HTML. La primera ampliación entrega las notas de forma privada al instructor. | Incorporar propósito, uso del recurso visual y vínculo al bloque cuando corresponda. Definir formato de reproducción y guion completo para teleprompter. |
| 7. Guía del ponente | Hay exportación HTML que combina preparación, bloques, conceptos y actividades con respuestas. | Completar la ruta breve y profunda, referencias estables entre documentos y discrepancias que pide el entregable. |
| 8. Plan de contingencias | El esquema de materiales de sesión revisado carece de un campo y generador específicos. | Añadir situaciones, condiciones de activación, alternativa, recursos e impacto en tiempos y evidencias. |
| 9. Formato de registro de la sesión | El esquema de autoría revisado carece de esta plantilla. Hub ya tiene estado de participación, respuestas y entregas, que requiere correspondencia con los campos acordados. | Distinguir la plantilla generada por Architect de los registros reales que se completan al impartir la sesión. Separar campos de sesión y de participante. |
| 10. Fuentes y referencias consolidadas | Parcial. Las piezas conservan IDs de fuentes y la exportación incluye las fuentes utilizadas. | Consolidar trazabilidad a conceptos, afirmaciones y evidencias, con localizadores y avisos de respaldo incompleto. |
| 11. Ficha de conducción por sesión | El esquema revisado carece de una ficha específica. La guía contiene parte de la información necesaria. | Derivar una ficha breve del plan, guía y contingencias aprobados con referencias al detalle. |
| 12. Ayudas de trabajo | Las plantillas de actividad aportan una base parcial. | Definir el criterio de aplicabilidad y el tipo de ayuda, sus verificaciones y condiciones de escalamiento. |
| 13. Aplicación y refuerzo posterior | Los planes híbridos tienen enlaces a lecciones antes o después de la sesión. | Añadir actividades posteriores tipadas con evidencia, criterio, responsable y alternativa simulada. Acordar dónde se ejecuta cada actividad. |
| 14. Alternativa por ausencia | El esquema revisado carece de una actividad de recuperación específica. | Definir objetivo, recursos, evidencia y reglas de revisión, con atención a lo que requiere observación o interacción humana. |

### Generación y limitaciones del paquete inicial

La generación síncrona usa tres operaciones, **AGENDA**, **PLAN** y **MATERIALS**. Hay configuración de prompts y modelos, trabajos de fondo, reserva por revisión, guardado por unidad y reanudación de pendientes. La aprobación verifica hashes de entradas y contenido. La exportación obtiene material del participante, presentación y guía del facilitador del mismo material estructurado. Esta base puede ampliarse para producir los entregables acordados.

El paquete inicial proyectaba escenas de título y viñetas y prácticas con instrucciones y plantilla. La ampliación local incorpora bloques, tiempos y notas privadas. Siguen pendientes las referencias de fuentes, guías y archivos nuevos; el constructor conserva las listas vacías de archivos y cuestionarios. La generación acepta hasta 40 láminas y 30 actividades, mientras la entrega admite 12 escenas y 20 prácticas. El exceso se rechaza. La comprobación de paquete listo debe incorporar la compatibilidad con el estudio antes de presentar el envío como disponible.

El guion aprobado, las encuestas de opinión y los vínculos de B-roll o videos demo/guía con bloques todavía requieren contrato síncrono. Existen capacidades multimedia en el dominio de producción de Architect; la revisión del constructor de entrega no muestra una conexión de esas capacidades con este paquete. El quiz actual tiene una respuesta correcta obligatoria. Una encuesta de opinión necesita su propio modelo o una ampliación compatible.

### Desarrollo propuesto desde los entregables

1. **Cerrar la estructura de autoría.** Ampliar los esquemas existentes con las piezas faltantes y relaciones estables entre sesión, bloque, actividad, instrumento y recurso. Registrar aplicabilidad de entregables condicionales, con resultado requerido o motivo de exclusión aprobado.
2. **Ordenar las dependencias.** Aprobar plan global, generar agenda y planes por sesión, producir instrumentos/materiales/presentación, y derivar guía, contingencias, ficha y referencias desde versiones coherentes. Si una entrada cambia, marcar las salidas dependientes que requieren revisión. Los prompts de las capturas sirven como requisitos de generación y deben traducirse a campos y validaciones comprobables.
3. **Construir una revisión de preparación por sesión.** Agrupar los entregables aprobados y sus relaciones en un manifiesto versionado. Guardar archivos por separado. Crear vistas autorizadas de instructor y participante en Academy y conservar el orden del plan detallado.
4. **Extender la API Academy → Hub.** Entregar el manifiesto autorizado, el orden de bloques y los recursos necesarios para cada rol. Conservar el acceso a sesión y snapshot actuales y negociar la ampliación con clientes anteriores.
5. **Distribuir en Hub.** Presentar la secuencia al instructor, enlazar escenas y medios a sus bloques, mostrar consignas y documentos al grupo según publicación, y abrir el guion en un panel privado. Guardar las evidencias y los resultados reales mediante operaciones autorizadas de Academy.

La integración requiere controles independientes de **contenido generado**, **contenido aprobado y vigente**, **paquete compatible y recibido**, y **recursos cargados en Hub**. Cada estado debe proceder de su operación y quedar vinculado a la misma revisión.

### Verificaciones que completan el contrato

- Una sesión de ejemplo cubre los 11 entregables base y declara la aplicabilidad de los tres condicionales. Cada elemento tiene identidad y referencias verificables.
- La suma de los bloques coincide con la duración de la sesión. Diapositivas, clips, actividades y guion se vinculan al bloque correcto.
- Cambiar el plan o una fuente marca los derivados afectados y exige nueva revisión antes de entregar.
- El participante recibe instrucciones, documentos y criterios públicos autorizados. Las respuestas esperadas y notas privadas se excluyen de su respuesta API.
- Un instructor carga la misma revisión desde otro equipo. Repetir el envío conserva la entrega y la evidencia de ejecución previa según las reglas de actualización.
- La ausencia de un recurso obligatorio, una referencia rota, un formato incompatible o un límite excedido produce un error accionable antes de activar la preparación.
- La plantilla de registro permite capturar resultados reales sin mezclar ejemplos generados con asistencia, respuestas o evidencias de participantes.

## Recorrido del piloto

1. Entregar una sesión de un curso híbrido de QA con láminas estructuradas y una práctica. Comprobar confirmación en Architect, revisión correcta en Hub y acceso del alumno a sus lecciones en Learning.
2. Repetir el envío tras simular una respuesta perdida y abrir Hub en otro equipo autorizado. Verificar que se recupera la misma revisión. Probar denegación para otra organización o curso, para un instructor sin permiso y para un destino incompatible.
3. Añadir una diapositiva renderizada y un clip. Comprobar recursos incompletos, expiración de enlaces, carga desde el aula y emisión audiovisual real con la política de audio elegida.
4. Añadir un guion privado. Verificar el acceso del instructor y comprobar con una cuenta de alumno que el guion queda fuera de respuestas, URLs, escenas, salida y grabación. Revisar el caso de un instructor que comparte su pantalla para definir cómo se protege el panel en ese modo.

Quedan por acordar el formato visual de las diapositivas, la fuente del guion, la política de audio para B-roll, los límites por archivo y el inventario de recursos adicionales. Este análisis fue estático. La apertura en otro equipo, la emisión efectiva y el aislamiento del teleprompter requieren pruebas de QA.

## Referencias de código

Verificación local del 17 de noviembre de 2026 en CourseForge mediante `npm run test:course-delivery`. Resultado de las tres suites de archivos existentes, **25 pruebas aprobadas y 0 fallidas**. El comando compila las fuentes incluidas por su configuración y ejecuta pruebas de lógica y trabajador con dobles de base y generador. La calidad de una generación real y el recorrido Academy → Hub requieren el piloto.

La inspección de generación incluye `apps/web/src/domains/course-delivery/types/delivery.schemas.ts`, `config/delivery.config.ts`, `services/delivery-generation.ts`, `services/delivery-readiness.ts`, `services/delivery-export.ts` y `lib/delivery-policy.ts`. Las últimas cinco rutas son relativas al mismo dominio.

- **Architect** — `apps/web/src/domains/course-delivery/services/delivery-live.ts`, `delivery-live-payload.ts` en el mismo directorio y `apps/web/src/domains/course-delivery/types/engine-preparation.contract.ts`.
- **Learning** — `apps/web/src/features/live/studio.service.ts` y `live-studio-domain.ts` en el mismo directorio. [Recorrido y ramas coordinadas de QA](../operations/synchronous-testing-release.md)
- **Hub** — [Contrato de preparación](../../src/shared/engine-preparation.contract.ts), [escenas del instructor](../../src/components/learning-live/instructor/InstructorStudio.tsx), [visualización de escenas](../../src/components/learning-live/instructor/StudioSceneCanvas.tsx), [programa audiovisual](../../src/components/learning-live/instructor/useStudioProgram.ts) y [guía del aula](learning-live-workspace.md).
