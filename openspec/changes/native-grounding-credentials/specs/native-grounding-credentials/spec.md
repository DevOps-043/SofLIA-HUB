## ADDED Requirements

### Requirement: Credencial nativa de investigación
Electron SHALL resolver la credencial Gemini en main bajo la autoridad vigente
tras admitir el trabajo en su cuota física. El renderer SHALL enviar contexto,
modelo e identificador, y mantener el transporte web en modo independiente.

#### Scenario: Clave enviada por IPC
- **WHEN** el payload contiene una clave u otro campo no permitido
- **THEN** main rechaza antes de consultar la credencial o iniciar HTTP

#### Scenario: Sesión o trabajo cancelado mientras se resuelve la clave
- **WHEN** cambia la sesión o se cancela durante la consulta
- **THEN** el trabajo termina sin iniciar HTTP ni publicar datos y conserva la plaza hasta concluir físicamente

#### Scenario: Investigación Electron con fuentes
- **WHEN** una solicitud válida obtiene una respuesta con fuentes
- **THEN** conserva herramientas, gráficas, fuentes y cancelación sin resolver credenciales en renderer
