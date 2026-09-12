## Purpose

Permite que SofLIA razone y actúe con varias pestañas conservando evidencia, control humano y límites por sitio.

## ADDED Requirements

### Requirement: Contexto explícito y citable
El usuario SHALL poder referenciar una o varias pestañas por nombre o selector, y cada respuesta basada en navegador SHALL conservar las pestañas y fragmentos usados como fuentes.

#### Scenario: Comparar pestañas
- **WHEN** el usuario adjunta varias pestañas y solicita una comparación
- **THEN** SofLIA limita el análisis a esas fuentes y reporta su procedencia

#### Scenario: Selección explícita y lectura fresca
- **WHEN** la persona usa `@` o el menú de adjuntos y elige hasta ocho pestañas por título o sitio
- **THEN** main valida perfil y recibo de documento antes y después de la autorización/lectura; devuelve hasta 3000 caracteres de texto observado por pestaña, nunca contenido almacenado en el chip

#### Scenario: Lote incompleto u obsoleto
- **WHEN** una pestaña cambia, se cierra, no entrega texto o la lectura supera quince segundos
- **THEN** no se envía un análisis parcial, se conserva el borrador y se indica revisar o quitar el adjunto; el lote se revalida antes de enviarlo

#### Scenario: Preparación interrumpida
- **WHEN** se detiene, desmonta el compositor o cambia su conversación, identidad u organización durante la preparación
- **THEN** se descartan resultados tardíos sin iniciar otra lectura ni enviar el turno; un segundo clic no duplica la preparación, sin afirmar que una llamada IPC ya emitida se haya deshecho

#### Scenario: Evidencia conservada y límites visibles
- **WHEN** se responde o regenera un turno con extractos adjuntos
- **THEN** conserva identificadores, texto, título, URL saneada y fecha en la metadata existente del chat; regenerar reutiliza esa evidencia histórica, no relee páginas, y la UI permite desplegar los fragmentos y avisa sobre citas inexistentes o ausentes

#### Scenario: No ampliar fuentes desde el contenido adjunto
- **WHEN** un extracto contiene palabras de investigación, instrucciones o solicitudes de control
- **THEN** no activa captura implícita, lectura de documento activo, búsqueda web o archivos hospedados; sólo permanece el workspace de una Skill elegida, sin descarga de nuevas fuentes, y el dispatcher rechaza herramientas fuera de ese alcance

### Requirement: Política del agente por sitio
El navegador SHALL ofrecer modos estricto y equilibrado, además de decisiones bloquear, permitir una vez y permitir siempre por origen. La política SHALL aplicarse antes de capturar o interactuar.

#### Scenario: Primer acceso en modo estricto
- **WHEN** el agente intenta observar un origen sin decisión
- **THEN** solicita autorización y no captura ni actúa antes de recibirla

#### Scenario: Pestaña o autorización modificada durante la tarea
- **WHEN** cambia la pestaña activa, el perfil, la ventana o la política durante una tarea visual, incluso si el usuario vuelve a la pestaña original
- **THEN** se invalida la tarea y no se reutiliza la captura ni se continúa automáticamente sobre el nuevo destino

#### Scenario: Documento modificado durante la decisión
- **WHEN** cambia el documento entre su captura y la ejecución, o mientras se dibujan las marcas
- **THEN** se descartan el contexto obsoleto y las coordenadas; una navegación propia requiere nueva captura y evaluación de política

#### Scenario: Cancelación durante una operación pendiente
- **WHEN** llega la señal de cancelación durante autorización, captura, espera o escritura nativa
- **THEN** no se inicia la siguiente captura, solicitud al modelo o entrada de teclado; el permiso pendiente se retira y una aprobación tardía no persiste autorización

### Requirement: Supervisión y toma de control
Durante una tarea SHALL existir indicador visible, detener, pausar y tomar control. Envíos, pagos, publicaciones, borrados, identidad y datos sensibles SHALL exigir confirmación o handoff al usuario.

#### Scenario: Detención desde el ciclo de vida general
- **WHEN** se cancela una tarea visual de navegador por identificador o se detienen todas, incluso durante su apertura
- **THEN** la señal alcanza el arranque y el loop; no se inicia otra captura, consulta o acción y el resultado es cancelado, no completado

#### Scenario: Proveedor o confirmación que no responde
- **WHEN** se detiene la tarea mientras espera al modelo o una confirmación
- **THEN** deja de esperar localmente, transmite la señal al SDK y descarta respuestas tardías; no afirma cancelar cómputo o cargos del proveedor ni deshacer entradas nativas ya emitidas

#### Scenario: Exclusión durante cancelación
- **WHEN** todavía no termina una operación nativa de la tarea cancelada
- **THEN** no admite otra tarea visual de navegador en el mismo servicio y conserva la propiedad del control hasta terminar su limpieza

#### Scenario: Detener todo con tareas en cola
- **WHEN** se detienen todas las tareas y hay trabajo esperando turno
- **THEN** se retira la cola, se limpian sus temporizadores/listeners y cada solicitud recibe un resultado cancelado sin ejecutarse

#### Scenario: Pago
- **WHEN** el agente llega a un paso de pago
- **THEN** se detiene antes de introducir información o confirmar y transfiere el control al usuario

#### Scenario: Pausa y reanudación supervisadas
- **WHEN** el titular pausa una tarea visual integrada en ejecución
- **THEN** cancela la espera al modelo y su permiso pendiente, conserva la reserva mientras drena entrada nativa y sólo entonces publica `paused`; reanudar conserva ID, guarda de destino y presupuesto acumulado, pero obtiene captura y conversación nuevas sin ejecutar la respuesta anterior

#### Scenario: Comando humano obsoleto
- **WHEN** un comando de pausa o reanudación no coincide con la revisión actual de ejecución, perfil o tarea
- **THEN** main lo rechaza sin cambiar la ejecución; detener y tomar control pueden usar una revisión de ejecución anterior de la misma tarea/perfil porque sólo reducen autoridad

#### Scenario: Toma de control durante una espera
- **WHEN** se detiene desde los controles, se toma control, se cierra la ventana o se invalida el destino durante la pausa
- **THEN** despierta la espera con cancelación, no vuelve a capturar, retira los avisos de permiso cancelados y conserva el indicador de finalización hasta drenar la operación nativa; no declara deshechos los efectos ya emitidos

#### Scenario: Supervisión visible
- **WHEN** comienza una tarea supervisada
- **THEN** mantiene controles fuera de pantalla completa HTML, requiere acoplar primero una pestaña separada y no ofrece reanudar durante arranque, pausa pendiente ni detención; los acuses IPC no sustituyen el estado autoritativo

### Requirement: Derivación local de formularios sensibles
La protección local de formularios SHALL preceder las observaciones y acciones gobernadas. Un documento que contenga formularios no identificados como búsqueda, secretos, campos de pago/identidad, señales de datos médicos o estructuras no inspeccionables SHALL derivarse a la persona, sin un botón de aprobación que levante ese bloqueo. El bloqueo es efímero por documento; no es una clasificación infalible de contenido visual ni cubre capturas del escritorio completo.

#### Scenario: Formulario sensible o valor rellenado
- **WHEN** la inspección local detecta riesgo o main va a rellenar una credencial
- **THEN** invalida capturas y autorizaciones del documento, solicita detener la tarea supervisada y muestra un aviso para continuar manualmente; no transmite valores al detector remoto ni libera control antes del drenaje nativo

#### Scenario: Riesgo que aparece durante una captura
- **WHEN** el documento adquiere contenido sensible mientras se espera una lectura o captura
- **THEN** una segunda inspección y el indicador persistente del mundo aislado impiden publicar el resultado; no se reutiliza una captura anterior como fallback

### Requirement: Voz humana sobre el navegador existente
Orbe SHALL reconocer órdenes literales con prefijo `navegador` para pestaña siguiente/anterior, estado, pausa, reanudación, detención y toma de control, delegando al navegador y supervisor existentes, sin crear un agente nuevo ni interpretar órdenes de páginas/modelos.

#### Scenario: Orden por voz
- **WHEN** el dictado humano entrega una orden soportada desde la ventana Orbe autenticada
- **THEN** main valida marco y ventana, actúa sobre el estado vigente y responde sin leer páginas ni títulos; cambiar pestañas requiere no estar bajo control del agente y reanudar exige confirmación nativa ligada al recibo de tarea/perfil

#### Scenario: Orden desconocida o revisión tardía
- **WHEN** el prefijo de navegador contiene una orden no soportada o cambia la ventana/sesión/tarea durante la confirmación
- **THEN** no se envía al modelo para reinterpretarla ni se actúa con un recibo obsoleto; detener puede interrumpir la tarea mientras se revisa una reanudación

### Requirement: Bitácora saneada
Cada tarea SHALL conservar pasos, pestaña, URL saneada, decisión de política, confirmaciones, resultado y capturas sólo cuando la política lo permita; nunca secretos ni valores de formularios.

#### Scenario: Revisar una tarea
- **WHEN** el usuario abre la bitácora
- **THEN** puede reconstruir qué observó y accionó SofLIA y eliminar la evidencia

#### Scenario: Evidencia cifrada y mínima
- **WHEN** se ejecuta una operación con gobierno avanzado habilitado
- **THEN** registra inicio y resultado bajo traza común con pestaña seudónima y origen, cifra el detalle por perfil y excluye formularios, argumentos, resultados textuales, errores crudos y capturas

#### Scenario: Confirmación de borrado o retención obsoleta
- **WHEN** cambia perfil, ventana o control, vence el plazo de cinco minutos o ya hay otra revisión pendiente
- **THEN** no se elimina evidencia ni se cambia la retención; consultar páginas de 50 no concede capacidad de fabricar eventos

#### Scenario: Operación interrumpida
- **WHEN** falla registrar el inicio o termina el contexto antes del resultado
- **THEN** respectivamente no se ejecuta la operación o se conserva sólo su inicio sin recrear el perfil cerrado; completar una operación no acredita cumplir el objetivo del usuario

#### Scenario: Retención acotada
- **WHEN** se consulta o registra evidencia
- **THEN** se aplica la retención elegida de 7/30/90 días, 30 por defecto, con máximo 5.000 eventos; borrar requiere HITL nativo y no promete eliminación forense del almacenamiento

### Requirement: Atajos y memoria opcional
El usuario SHALL poder guardar instrucciones reutilizables con alcance, fuentes y permisos declarados, y habilitar búsqueda semántica sobre historial y marcadores con retención y borrado explícitos.

#### Scenario: Memoria desactivada
- **WHEN** la búsqueda semántica no está habilitada
- **THEN** el agente no indexa ni consulta historial o marcadores

#### Scenario: Índice semántico revisado y acotado
- **WHEN** el titular habilita la memoria desde el panel humano del perfil persistente
- **THEN** una confirmación nativa informa que Google recibe títulos, rutas URL sin parámetros/fragmentos y consultas, con posible coste; sólo una reconstrucción explícita envía hasta 200 visitas recientes y 200 marcadores, sin cuerpos de páginas, formularios ni contraseñas

#### Scenario: Fuentes eliminadas, cancelación o perfil cambiado
- **WHEN** se busca o termina una reconstrucción
- **THEN** se contrastan las fuentes con sus stores actuales, se excluyen entradas eliminadas o modificadas, se descartan resultados obsoletos/cancelados y se conservan citas de fuente; el índice local cifrado expira a los 30 días y puede deshabilitarse y borrarse con HITL sin borrar los originales

#### Scenario: Atajo reutilizable de lectura
- **WHEN** el titular guarda o edita una instrucción de hasta 5000 caracteres con nombre de hasta 80
- **THEN** main conserva hasta 50 atajos cifrados por perfil persistente con alcance `selected-tabs` y permiso `read-fragments`; no guarda páginas, secretos, concesiones de sitio ni ejecución automática

#### Scenario: Recuperación explícita de atajos

- **WHEN** la biblioteca fue recuperada desde una copia compatible con confirmación nativa
- **THEN** sus IDs y revisión se renuevan, no se ejecuta ni se concede acceso a páginas y los editores antiguos no pueden guardar sobre las instrucciones recuperadas

#### Scenario: Borrado de atajos con respaldo
- **WHEN** la persona confirma eliminar un atajo
- **THEN** se advierte y se retiran todas las copias locales de recuperación de la biblioteca antes de guardar; no se promete borrado forense

#### Scenario: Preparar un borrador desde el atajo
- **WHEN** el usuario elige un atajo
- **THEN** prepara un borrador sin sobrescribir otro, exige seleccionar de una a ocho pestañas frescas y enviar manualmente; rechaza modos, Skills u otros adjuntos que amplíen el alcance y reutiliza el análisis limitado a fragmentos sin herramientas externas

#### Scenario: Atajo obsoleto o eliminación cancelada
- **WHEN** cambia perfil/ventana, hay una revisión concurrente, el archivo está dañado o se cancela la confirmación de eliminación
- **THEN** no reemplaza instrucciones ni borra datos, conserva el archivo y devuelve un error controlado o cancelación; el perfil privado/invitado no persiste atajos
