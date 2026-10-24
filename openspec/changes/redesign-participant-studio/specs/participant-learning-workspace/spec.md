## ADDED Requirements
### Requirement: Aula compacta del participante
El sistema MUST presentar escenario, actividades compactas, chat hasta el borde inferior y controles flotantes con un único acceso a salas.
#### Scenario: Entrada a clase
- **WHEN** el alumno abre una sesión autorizada
- **THEN** ve escenario y actividades y sus dispositivos permanecen apagados hasta que los active
#### Scenario: Barra superpuesta
- **WHEN** el alumno consulta las actividades
- **THEN** el panel llega hasta abajo, la barra flota encima y puede desplazar el contenido para alcanzar los controles inferiores
#### Scenario: Controles discretos del video
- **WHEN** el alumno pasa el cursor sobre el escenario o enfoca sus controles
- **THEN** aparecen solo iconos de conexión, subtítulos y fullscreen, sin franja fija ni ingreso en el encabezado
#### Scenario: Mover y contraer controles
- **WHEN** el alumno arrastra el asa, usa las flechas o pulsa para contraer
- **THEN** la barra permanece dentro del área y conserva el estado audiovisual; el clic posterior a arrastrar no la contrae
### Requirement: Conversaciones separadas
El sistema MUST separar chat público y ayuda Soflia sin compartir automáticamente conversaciones ni respuestas privadas.
#### Scenario: Reacción sobre el video
- **WHEN** un participante envía una reacción permitida
- **THEN** se muestra cinco segundos en el video de su sala sin insertar un mensaje ni incrementar estadísticas
#### Scenario: Espera configurada
- **WHEN** el instructor aplica un intervalo de 0 a 300 segundos
- **THEN** Learning limita envíos del participante por sesión bajo bloqueo transaccional, conserva idempotencia y el editor presenta el plazo sin perder el borrador
#### Scenario: Consumidor anterior
- **WHEN** un Hub no negocia participación
- **THEN** el backend conserva la forma del snapshot anterior sin campos adicionales
#### Scenario: API anterior
- **WHEN** el Hub nuevo consulta una API que valida el cuerpo con el contrato anterior
- **THEN** envía la negociación en cabecera y conserva el JSON previo, abre el aula autorizada y oculta funciones sin confirmación del servidor
#### Scenario: Permiso denegado
- **WHEN** Learning rechaza identidad o membresía
- **THEN** Hub conserva la denegación y no intenta cambiar rol ni reintentar con permisos alternativos
#### Scenario: Pregunta privada
- **WHEN** el alumno pregunta a Soflia
- **THEN** se verifica política habilitada y consentimiento vigente antes del envío, no se publica un mensaje académico ni se conceden herramientas al modelo
#### Scenario: Consentimiento ausente o anterior
- **WHEN** la organización deshabilita IA o falta consentimiento vigente
- **THEN** se bloquea la solicitud antes de contactar al proveedor
#### Scenario: Mensaje en vuelo y nuevo borrador
- **WHEN** se confirma un mensaje mientras el alumno escribe otro
- **THEN** se conserva el nuevo borrador y un Enter repetido no duplica el envío pendiente
#### Scenario: Fallo de primera carga
- **WHEN** falla el primer snapshot y el alumno reintenta con éxito
- **THEN** se recuperan estado, suscripción de chat y presencia sin cerrar la suscripción de una sesión posterior
### Requirement: Accesibilidad audiovisual real
El sistema MUST ofrecer fullscreen y subtítulos con estados verificados por el proveedor.
#### Scenario: Subtítulos no habilitados
- **WHEN** la cuenta o el anfitrión no permite subtítulos
- **THEN** informa indisponibilidad y no afirma estar transcribiendo
#### Scenario: Configuración durante llamada
- **WHEN** el alumno selecciona un dispositivo del Video SDK
- **THEN** se valida contra su lista real, se aplica con métodos del SDK y una fuente apagada no se activa por seleccionarla
