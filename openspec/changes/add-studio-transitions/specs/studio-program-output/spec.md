## Purpose
Entregar a la llamada exclusivamente el programa compuesto, mediante una salida
local continua con autorización y aislamiento de ventanas.

## ADDED Requirements
### Requirement: Salida explícita y aislada
Preparar salida SHALL requerir una acción del instructor y no SHALL iniciar una
transmisión ni mostrar En vivo por inferencia. La llamada SHALL capturar únicamente
el programa dedicado, nunca los paneles ni la cuenta del instructor.
#### Scenario: Salida preparada sin llamada
- **WHEN** el instructor prepara el programa
- **THEN** se identifica como salida local y no se afirma que el grupo lo recibe
#### Scenario: Llamada comparte programa
- **WHEN** el instructor pulsa Compartir en la llamada con programa listo
- **THEN** obtiene una fuente continua que conserva transiciones y pantallas

### Requirement: Concesión restringida y limpieza
Solo el frame principal autenticado dueño SHALL preparar/cerrar la salida; solo
el receptor exacto SHALL responder a su negociación vigente. Cambio de cuenta,
navegación, cierre, timeout o fallo SHALL revocar la salida sin conceder otra fuente.
#### Scenario: Receptor o solicitante equivocado
- **WHEN** otro renderer, subframe o una negociación anterior intenta operar
- **THEN** se rechaza sin crear ni modificar salida
#### Scenario: Cambia la identidad
- **WHEN** cambia la cuenta mientras se prepara o comparte el programa
- **THEN** se destruye la ventana y no se reutiliza la concesión anterior
