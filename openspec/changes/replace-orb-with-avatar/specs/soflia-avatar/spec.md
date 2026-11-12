## ADDED Requirements

### Requirement: Identidad visual aprobada
El renderer SHALL usar el avatar original en composición 2D transparente, sin WebGL ni modelos 3D.

#### Scenario: Voz e instalador
- **WHEN** se monta OrbCanvas en cualquiera de sus consumidores
- **THEN** presenta el mismo cuerpo, logo, bandas, luces y reflejos originales mediante SofliaAvatar, conservando contratos de voz y asistencia

### Requirement: Expresiones y controles
El avatar SHALL ofrecer idle, listening, thinking, speaking, success, warning, curious, happy, confused, focused, acknowledging y sleeping, y los métodos setState, setExpression, setAudioLevel, setGazeTarget, blink, nod y reset.

#### Scenario: Prioridad
- **WHEN** llega una expresión decorativa durante un estado prioritario
- **THEN** conserva la expresión de ese estado y cancela gestos incompatibles

### Requirement: Mirada y movimiento accesibles
El avatar SHALL seguir el puntero dentro de la ventana con coordenadas normalizadas, interpolación suave y límites configurables, moviendo únicamente ojos.

#### Scenario: Retorno y suspensión
- **WHEN** el cursor sale del radio, la ventana pierde foco, el avatar queda oculto o se solicita movimiento reducido
- **THEN** devuelve la mirada al centro al salir del radio o perder foco, suspende movimiento al ocultarse o reducir movimiento, y mantiene la voz mientras la ventana flotante carece de foco, sin acumular bucles ni listeners

### Requirement: Visor uniforme y expresiones de referencia
El avatar SHALL eliminar las cuencas y sombras oculares del visor y representar expresiones planas luminosas basadas en la referencia entregada por el usuario.

#### Scenario: Símbolos legibles y diferenciados
- **WHEN** se muestra espera, escucha, pensamiento, respuesta, éxito, advertencia o duda
- **THEN** presenta respectivamente barras, onda, círculo de puntos, cara con boca reactiva, check grande, exclamación grande o pregunta grande, sin ojos residuales detrás

### Requirement: Audio sin permisos adicionales
El avatar SHALL consumir amplitud existente durante escucha y habla, con nivel cero si no hay señal.

#### Scenario: Amplitud real
- **WHEN** cambia la ref de nivel de audio
- **THEN** responde mediante luz y gesto sutil sin crear capturas ni renderizar React por frame

### Requirement: Gestos autónomos en todas las expresiones
Cada expresión SHALL mantener movimiento propio sin interacción ni audio, dentro del mismo bucle visual y respetando pausa y movimiento reducido.

#### Scenario: Confirmación mediante asentimiento
- **WHEN** el avatar entra en acknowledging y permanece varios ciclos sin interacción
- **THEN** muestra una cara sin palomita ni insignia cuyo rostro asiente repetidamente dentro del visor, con el cuerpo casi estable y sin rotación lateral

### Requirement: Expresividad facial y reacción acústica
El avatar SHALL mover el rostro independientemente del cuerpo, ampliar la mirada y ofrecer surprised y concerned además de sus expresiones anteriores.

#### Scenario: Voz aguda, grave o fuerte
- **WHEN** cambia el registro, las bandas o la amplitud de la señal existente durante escucha
- **THEN** la onda y el rostro responden suavemente sin abrir otra captura ni simular una señal ausente

#### Scenario: Articulación de respuesta
- **WHEN** el audio de salida contiene voz, pausas y cambios espectrales
- **THEN** la boca cambia apertura, anchura y redondez con el sonido y se cierra en pausas, sin afirmar alineación fonética no disponible

#### Scenario: Actividad sin señal de voz
- **WHEN** cualquier expresión permanece activa con amplitud cero y sin puntero
- **THEN** su gesto ambiental continúa, sin modificar ni simular el nivel de audio real

### Requirement: Demostración reproducible
El cambio SHALL entregar recursos PNG transparentes, máscaras SVG, demostración interactiva y GIF/WebM derivados del componente.

#### Scenario: Validación aislada
- **WHEN** se abre la fixture sin sesión ni proveedores
- **THEN** permite revisar expresiones, controles, tamaños, fondos y amplitud con origen de demostración explícito


### Requirement: Presencia reactiva en Hub
El personaje SHALL sustituir al asistente femenino en chat general, navegador y proyectos, y reaccionar a eventos reales del turno sin alterar permisos.

#### Scenario: Activación y reposo
- **WHEN** se activa el personaje y después transcurren 20 segundos sin interacción ni tarea activa
- **THEN** saluda con alegría, vuelve a espera y entra en reposo con Zzz exteriores

#### Scenario: Permisos, resultados y ejecución
- **WHEN** una tarea pide permiso, sigue ejecutándose, falla o concluye con resultado estructurado exitoso
- **THEN** muestra respectivamente advertencia, concentración, preocupación o éxito, con confirmación conversacional mediante asentimiento

#### Scenario: Borradores locales
- **WHEN** el usuario escribe en el buscador o compositor
- **THEN** el personaje expresa curiosidad, sorpresa, duda o advertencia mediante reglas locales, sin enviar texto ni autorizar acciones

#### Scenario: Página nativa aislada
- **WHEN** se abre el inicio nativo del navegador
- **THEN** usa los mismos recursos y expresiones, con un único script local firmado por hash CSP y sin Node, IPC ni conexiones

#### Scenario: Generación superada
- **WHEN** el usuario cambia conversación o cancela una generación
- **THEN** los callbacks anteriores no alteran el gesto ni el estado de carga del turno vigente y no celebran éxito
