# Chat flotante: implementación y verificación

Fecha: 2026-10-24. Implementado dentro del renderer de la ventana principal; compuerta de PR aprobada. Panel y selector inspeccionados en vivo durante la revisión de diseño; el flujo completo posterior quedó interrumpido por la pantalla de inicio de sesión.

## Resultado

AppWorkspace reutiliza una única instancia del chat real en el panel compacto, con icono oficial, modelo, contexto automático al enviar, adjuntos/dictado y Stop. Nuevo chat está disponible en la cabecera y el navegador conserva acceso a conversaciones. En proyectos se prepara un destino propio y editable antes de montar el compositor, sin cambiar al apartado de chats ni reutilizar una conversación ajena. La respuesta usa el streaming existente y el icono de marca sustituye al avatar de Soflia en esta presentación. Minimizar no desmonta el chat.

La lectura contextual sólo ocurre al enviar. La app proporciona texto acotado del contenido principal que está en viewport, sin campos editables, regiones privadas ni texto del chat. El navegador proporciona DOM y captura mediante las políticas de main existentes; un cambio de pestaña/URL/perfil descarta el resultado. Hay timeout y señal de cancelación; una operación expirada no continúa con nuevas consultas. Los errores mantienen el borrador y no llaman al modelo afirmando disponer de contexto. Las pestañas adjuntas explícitas conservan el modo de extractos y no disparan esta lectura adicional.

El navegador reserva una franja inferior según la altura real del dock. La página permanece viva y operable; no hay una captura estática superpuesta ni ventana adicional. Los menús de adjuntos y las confirmaciones se presentan mediante portal y marcador de overlay para retirar temporalmente la superficie nativa. Cerrar restaura el viewport. Los archivos conservan vista previa mediante diálogo interno sin retirar el chat.

## Revisión adversarial

Se comprobó identidad, organización, proyecto, conversación y descarte de resultados tardíos. Se detectó y corrigió una regresión potencial: persistir el primer borrador null→id no debe abortar la primera respuesta. Abrir otro chat sí invalida la generación y descarta incluso su cierre, evitando escribir mensajes del destino anterior. La pérdida de acceso editable también cancela el turno. Stop explícito conserva su respuesta de cancelación en el chat actual.

La captura no concede permisos y el contenido entra como material no confiable. No se agregan canales IPC ni herramientas. La ejecución mantiene las confirmaciones del controlador DOM y Computer Use. No se abre el orbe externo. No se modifican base de datos, secretos ni preferencias del SO.

Al remontar la vista se omiten del historial visible los marcadores heredados sin generación propietaria, sin escribir automáticamente en otra conversación; la siguiente acción humana usa el historial limpio. La presentación compacta no implica que haya un navegador abierto: ese estado se transmite por separado para las Skills. La cancelación no revierte acciones que ya se hayan ejecutado.

## Evidencia

Las pruebas focalizadas cubren abrir/minimizar/reabrir, icono sin avatar, borrador, preparación fallida/tardía, contexto excluido/no confiable, timeout/Stop, cambio de pestaña, conversación y proyecto, streaming real del componente con proveedor simulado, omisión de captura al desactivar Contexto visible y geometría de viewport/confirmaciones. Los logs viven en `floating-final-tests.log`, `floating-integration-tests.log`, `floating-types.log` y `floating-lint.log` en el directorio de trabajo de la conversación. No son respuestas de una cuenta real del proveedor.

El lote focalizado de 160 pruebas pasó, y el lote posterior de regresión incluyó la recuperación del marcador interrumpido y el wrapper IPC de Project Hub (61 pruebas aprobadas). La primera compuerta general tuvo 5950 aprobadas y un fallo en `project-hub-bridge.test.ts`: esperaba una llamada de confirmación y contabilizó 31. El archivo completo pasó después de forma aislada; no se cambiaron su lógica ni los permisos para ocultar el fallo. Una ejecución posterior completa aprobó 5954 pruebas.

La ejecución general anterior terminó con código 0: 524 archivos y 5954 pruebas aprobadas, 2 archivos y 5 pruebas omitidas. Incluyó TypeScript, lint incremental, arnés, OpenSpec, documentación, catálogo de Skills y comprobaciones de calidad. Evidencia: `floating-pr-verified.log`, fuera del repositorio en el directorio de trabajo de la conversación. No se ejecutó la compuerta de release ni empaquetado. Una ejecución intermedia detectó inferencia de refs en MessageList; se separó la referencia de scroll y la opción visual del controlador antes de repetir la compuerta, sin desactivar reglas de lint.

### Revisión de diseño y Nuevo chat

Se corrigió la ausencia de Nuevo chat fuera del navegador y la navegación involuntaria del manejador global. La acción usa el gestor sin cambiar de vista; en proyectos usa su preparación existente. Una revisión local remonta sólo el compositor al crear el nuevo borrador, incluso si ambos IDs son null. Se eliminó la franja de contexto y su estado opcional, conservando lectura puntual automática. El selector compacto se superpone dentro del panel; ya no compite por altura en el flujo del historial. La composición flex limita el historial al espacio restante y conserva el área de escritura.

`floating-redesign-tests.log`: 34 pruebas dirigidas aprobadas, incluidas creación desde cabecera, exclusión de duplicados durante espera, reinicio del borrador, conservación de vista/proyecto y selección de modelo. `floating-redesign-gate.log`: `npm run verify:pr` terminó con código 0, 524 archivos y 5958 pruebas aprobadas; 2 archivos y 5 pruebas omitidas. Esta es la compuerta posterior a la revisión de código y CSS.

Se abrió el panel en el proyecto mediante la app real y se inspeccionaron su cabecera sin franja de contexto y el selector de modelos. La primera acción AX falló por geometría; una captura posterior permitió interactuar. Tras inspeccionar el selector se redujo su altura vacía; la app regresó después a inicio de sesión, sin causa atribuida aquí. No se ingresaron credenciales ni se enviaron mensajes de prueba reales. La comprobación completa de respuesta, scroll y reinicio del borrador en vivo queda pendiente; sus rutas están cubiertas mediante componente y proveedor simulado.

Se intentó inspeccionar la app en ejecución: estaba autenticada y mostró la vista principal. La acción de abrir herramientas falló por geometría de entrada no disponible y la captura nativa falló por ausencia de PID de ventana en primer plano. Se detuvo esa inspección; no se afirma QA visual ni una respuesta real de modelo por este recorrido. El navegador automatizado está deshabilitado en esta sesión y no se intentó sustituirlo por otra vía.

## Límites

El contexto automático se limita al apartado de la aplicación o la pestaña integrada actual. No captura continuamente el escritorio ni garantiza lectura de otras ventanas; el catálogo existente permite adjuntarlas o solicitar sus herramientas cuando corresponde. Las acciones de sitios protegidos dependen de sus políticas; un bloqueo permanece visible y no se evita. Las vistas pequeñas reducen el área web para dejar operable el compositor. La inspección visual y una respuesta real con proveedor siguen sin acreditarse; las comprobaciones funcionales usan proveedor simulado.
