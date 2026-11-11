## ADDED Requirements

### Requirement: Imagen nativa con identidad vigente
Electron SHALL generar imágenes en main sin recibir o retornar claves por IPC.
#### Scenario: Ventana y sesión autorizadas
- **WHEN** una ventana confiable solicita imagen con payload válido
- **THEN** main resuelve la clave vigente y retorna sólo el resultado acotado
#### Scenario: Sesión revocada o límite excedido
- **WHEN** cambia la sesión o se supera un límite de tamaño, plazo o concurrencia
- **THEN** no se publica una respuesta obsoleta ni se inicia trabajo no autorizado
#### Scenario: Navegador autónomo
- **WHEN** el producto funciona fuera de Electron
- **THEN** mantiene el flujo anterior de generación sin requerir preload
