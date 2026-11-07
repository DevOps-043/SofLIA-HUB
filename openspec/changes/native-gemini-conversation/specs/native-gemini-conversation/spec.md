## ADDED Requirements

### Requirement: Conversación nativa bajo autoridad vigente
Electron SHALL resolver Gemini y encadenar mensajes en main con cuotas y
propiedad de turno. Los consumidores SHALL conservar su dispatcher y resultados.

#### Scenario: Herramienta y continuación
- **WHEN** el modelo devuelve una llamada y el dispatcher produce su resultado
- **THEN** el siguiente mensaje usa historial curado con el mismo turno nativo

#### Scenario: Sesión o documento revocado
- **WHEN** cambia la autoridad, se cierra el turno o vence la llamada
- **THEN** se descartan respuestas e historial tardíos y se retiene la plaza hasta el fin físico

#### Scenario: Puente ausente o payload inválido
- **WHEN** Electron carece del puente o recibe datos fuera del contrato
- **THEN** falla sin usar una credencial del renderer ni ejecutar efectos locales
