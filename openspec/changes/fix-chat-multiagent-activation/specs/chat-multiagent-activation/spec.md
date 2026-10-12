## ADDED Requirements

### Requirement: Activación explícita en lenguaje natural
El selector SHALL activar dos especialistas cuando el usuario solicite usar
multiagentes en lenguaje natural. Modo directo MUST conservar prioridad.

#### Scenario: Petición de alternativas
- **WHEN** el usuario dice «usa los multiagentes para que cada uno proponga algo diferente»
- **THEN** se ejecutan dos especialistas con perspectivas diferentes antes del coordinador

#### Scenario: Mención informativa o negativa
- **WHEN** el usuario pregunta qué son multiagentes o pide no usarlos
- **THEN** la mención no fuerza un equipo

### Requirement: Contexto y resultado verificables en chat
Los especialistas SHALL recibir hasta seis mensajes recientes del mismo chat,
acotados a ocho mil caracteres y etiquetados como datos no confiables. El
coordinador MUST recibir el estado observado y no afirmar ejecución exitosa
cuando fallan los especialistas o no existe cupo.

#### Scenario: Seguimiento del encargo
- **WHEN** el usuario pide multiagentes tras una propuesta de activación para Rethink & Delight
- **THEN** cada especialista recibe ese encargo sin acceder a otros chats o memoria externa

#### Scenario: Equipo sin aportes
- **WHEN** no termina ningún especialista o falta capacidad
- **THEN** el coordinador recibe el estado real y puede continuar informando la limitación

### Requirement: Identidad de actividad y presupuesto breve
El chat MUST publicar actividad con la identidad SOFIA del usuario activo sin
modificar el alcance Lia de la memoria. Los especialistas SHALL usar razonamiento
bajo para el presupuesto de 1500 tokens; el coordinador MUST conservar el nivel elegido.

#### Scenario: Identidades federadas diferentes
- **WHEN** la identidad Lia de datos difiere de la identidad SOFIA validada por main
- **THEN** el monitor acepta el publicador SOFIA y conserva la guarda contra usuarios ajenos

#### Scenario: Coordinador en Máximo
- **WHEN** el usuario elige razonamiento Máximo
- **THEN** los workers usan low y la respuesta coordinada conserva Máximo

### Requirement: Progreso visible del chat y monitor flotante
El monitor SHALL mostrar inmediatamente los eventos reales del equipo del chat
actual y combinar sus estados con el monitor main sin duplicarlos. Los eventos
locales MUST estar ligados a la identidad activa y descartarse al cambiar de
usuario. Un rechazo IPC SHALL mostrarse sin ocultar el trabajo local observado.
El panel SHALL flotar sobre el chat sin reducir su ancho, con superficie del
tema, borde redondeado, altura acotada y un estado vacío compacto.

#### Scenario: Especialistas trabajando y fallo del monitor compartido
- **WHEN** comienzan dos especialistas reales y main rechaza publicar su actividad
- **THEN** el panel muestra ambos como trabajando y avisa de la indisponibilidad del monitor compartido

#### Scenario: Confirmación main y cambio de identidad
- **WHEN** llega la confirmación de un equipo local o cambia la identidad activa
- **THEN** la confirmación no duplica equipos ni revierte su estado y otra identidad no ve sus eventos locales tardíos

#### Scenario: Ventana flotante sin actividad
- **WHEN** se abre el monitor sin equipos en un chat
- **THEN** se muestra una ventana compacta sobre el canvas con colores del tema y el chat conserva todo su ancho
