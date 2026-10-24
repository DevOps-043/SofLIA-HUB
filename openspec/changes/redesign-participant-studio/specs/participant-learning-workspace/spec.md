## ADDED Requirements
### Requirement: Aula compacta del participante
El sistema MUST presentar escenario, actividades compactas, chat hasta el borde inferior y controles flotantes con un único acceso a salas.
#### Scenario: Entrada a clase
- **WHEN** el alumno abre una sesión autorizada
- **THEN** ve escenario y actividades y sus dispositivos permanecen apagados hasta que los active
#### Scenario: Barra superpuesta
- **WHEN** el alumno consulta las actividades
- **THEN** el panel llega hasta abajo, la barra flota encima y puede desplazar el contenido para alcanzar los controles inferiores
### Requirement: Conversaciones separadas
El sistema MUST separar chat público y ayuda Soflia sin compartir automáticamente conversaciones ni respuestas privadas.
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
