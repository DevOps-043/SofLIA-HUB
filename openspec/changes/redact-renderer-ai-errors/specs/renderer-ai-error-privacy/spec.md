## ADDED Requirements

### Requirement: Privacidad de errores en flujos de IA
El renderer SHALL evitar errores brutos en los registros de imagen, Flow, chat y dictado revisados.
#### Scenario: Fallo con información privada
- **WHEN** un proveedor falla con detalles sensibles
- **THEN** la consola y el mensaje de dictado muestran sólo mensajes controlados
#### Scenario: Recuperación de Flow
- **WHEN** falla una solicitud de Flow
- **THEN** se conserva la respuesta alternativa sin registrar el detalle bruto

#### Scenario: Acciones posteriores a investigación
- **WHEN** una acción posterior a la investigación falla o se cancela
- **THEN** se conserva el resultado de investigación y no se registra la excepción privada
