## ADDED Requirements
### Requirement: Aula compacta del participante
El sistema MUST presentar escenario, actividades compactas, chat hasta el borde inferior y controles flotantes con un único acceso a salas.
#### Scenario: Entrada a clase
- **WHEN** el alumno abre una sesión autorizada
- **THEN** ve escenario y actividades y sus dispositivos permanecen apagados hasta que los active
### Requirement: Conversaciones separadas
El sistema MUST separar chat público y ayuda Soflia sin compartir automáticamente conversaciones ni respuestas privadas.
#### Scenario: Pregunta privada
- **WHEN** el alumno pregunta a Soflia
- **THEN** se verifica política habilitada y consentimiento vigente antes del envío, no se publica un mensaje académico ni se conceden herramientas al modelo
#### Scenario: Consentimiento ausente o anterior
- **WHEN** la organización deshabilita IA o falta consentimiento vigente
- **THEN** se bloquea la solicitud antes de contactar al proveedor
### Requirement: Accesibilidad audiovisual real
El sistema MUST ofrecer fullscreen y subtítulos con estados verificados por el proveedor.
#### Scenario: Subtítulos no habilitados
- **WHEN** la cuenta o el anfitrión no permite subtítulos
- **THEN** informa indisponibilidad y no afirma estar transcribiendo
