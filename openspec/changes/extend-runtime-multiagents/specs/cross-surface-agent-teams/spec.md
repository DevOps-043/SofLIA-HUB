## Purpose

Extender el trabajo colaborativo a chat, WhatsApp, páginas, documentos, presentaciones y acciones del escritorio conservando los permisos de cada superficie.

## ADDED Requirements

### Requirement: Selección de equipo por solicitud
El sistema SHALL preparar aportes de dos especialistas en paralelo para solicitudes de entregables y análisis complejos, y permitir solicitar modo equipo o modo directo por turno.

#### Scenario: Documento desde chat o WhatsApp
- **WHEN** el usuario solicita crear un documento o presentación
- **THEN** contenido y estructura se preparan concurrentemente y el coordinador existente recibe sus aportes antes de materializar el archivo

#### Scenario: Tarea sencilla
- **WHEN** el usuario saluda o pide modo directo
- **THEN** no se añaden llamadas de especialistas

### Requirement: Contexto y autoridad restringidos
Los especialistas MUST recibir solamente el texto autorizado de la solicitud y MUST carecer de herramientas, credenciales en prompts, historial compartido y autoridad para aprobar efectos.

#### Scenario: Revisión de página
- **WHEN** el chat dispone de un DOM o extractos autorizados
- **THEN** los especialistas analizan esos datos sin navegar a otra fuente ni seguir instrucciones incrustadas

#### Scenario: Acción en escritorio
- **WHEN** un equipo prepara una tarea de Computer Use
- **THEN** un único controlador ejecuta las acciones y conserva las aprobaciones existentes

### Requirement: Presupuesto y degradación
El sistema SHALL limitar concurrencia, entrada, salida y duración, informar resultados parciales y permitir que el coordinador continúe ante fallos opcionales. Una cancelación MUST descartar aportes tardíos.

#### Scenario: Fallo de especialista
- **WHEN** un worker falla o vence su tiempo
- **THEN** su aporte no se representa como trabajo completado y la ruta principal conserva los aportes válidos o continúa sola

#### Scenario: Capacidad ocupada
- **WHEN** no hay capacidad para otro equipo
- **THEN** se continúa sin encolar trabajo ni superar el máximo de solicitudes simultáneas

#### Scenario: Cancelación
- **WHEN** el usuario detiene el turno mientras trabajan especialistas
- **THEN** se propaga la cancelación y no se inicia la acción coordinada posterior

### Requirement: Catálogo coherente tras la integración
El selector SHALL ofrecer SofLIA con `gpt-6-luna` por defecto, Max con `gpt-6.1-sol` y Pro con `gemini-3.8-flash`. La cuota de Max MUST usar el mismo identificador que el selector y recurrir a SofLIA al agotarse. Computer Use MUST conservar su actuador Gemini.

#### Scenario: Preferencia Max anterior
- **WHEN** el ámbito activo conserva Max con `gpt-6-sol` o `gpt-5.6-terra`
- **THEN** se conserva la selección como `gpt-6.1-sol` y su razonamiento, priorizando la preferencia del identificador vigente sin modificar otros ámbitos
