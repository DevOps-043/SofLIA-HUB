## Purpose

Garantizar que el envío Gmail prepare un correo íntegro y mantenga vinculada la autorización del usuario al mensaje, la conexión y los adjuntos que efectivamente se entregan al proveedor.

## ADDED Requirements

### Requirement: Contrato de envío cerrado y acotado
El sistema MUST validar tipos y campos de envío, exigir al menos un destinatario principal inequívoco y limitar el total de destinatarios a 20, asunto a 300 caracteres, cuerpo a 200000 caracteres y adjuntos a 10. MUST rechazar campos desconocidos y controles en cabeceras.

#### Scenario: Entrada ambigua o malformada
- **WHEN** un envío contiene destinatarios adicionales ocultos en una cadena, controles, tipos incorrectos o excede una cuota
- **THEN** no se lee ningún adjunto ni se llama al proveedor

### Requirement: Preparación íntegra de adjuntos y MIME
El sistema MUST preparar todos los adjuntos o rechazar el correo completo. MUST aceptar sólo rutas locales absolutas y archivos regulares, rechazar enlaces finales/dispositivos, acotar lectura a 10 MiB por archivo y 20 MiB acumulados, y limitar el MIME final a 30 MiB. MUST conservar Unicode y los destinatarios BCC en el mensaje entregado a Gmail.

#### Scenario: Solicitud del chat por encima de cuota
- **WHEN** la herramienta de chat solicita más adjuntos que los admitidos
- **THEN** se rechaza la solicitud completa, sin recortar la lista antes de invocar main

#### Scenario: Adjunto ausente o ilegible
- **WHEN** no se puede preparar cualquiera de los adjuntos solicitados
- **THEN** se informa un error seguro y no se envía una versión sin ese archivo

#### Scenario: Archivo cambia durante preparación
- **WHEN** un archivo crece, cambia o excede la cuota mientras se lee
- **THEN** se cierra su recurso y se rechaza el envío completo

### Requirement: Autorización nativa vinculada al envío IPC
El canal gmail:send MUST comprobar actor autenticado, ventana registrada, marco principal y documento propio; MUST vincular el envío a la conexión Google del actor. MUST requerir confirmación nativa de cuenta, destinatarios, asunto, cuerpo y adjuntos preparados, con cancelación por defecto y vigencia máxima de 120 segundos. La copia de adjuntos confirmada MUST ser la que se envía, sin releer las rutas.

#### Scenario: Contexto ajeno o aprobación vencida
- **WHEN** llama un marco no permitido, la aprobación vence o cambia sesión/conexión/ventana durante la confirmación
- **THEN** no se inicia el transporte y se liberan los listeners de la llamada

#### Scenario: Envío confirmado
- **WHEN** el usuario confirma un mensaje preparado y el contexto sigue vigente
- **THEN** el servicio realiza una sola invocación de envío al cliente del proveedor con esa copia y no la repite automáticamente ante un resultado incierto

### Requirement: Resultado explícito sin repetición automática
El sistema MUST informar éxito sólo con un identificador válido del proveedor y contexto vigente. Si el transporte pudo haber iniciado y no se puede confirmar su resultado, MUST indicar incertidumbre y no reintentar automáticamente. Los errores/logs MUST omitir contenido, destinatarios, rutas y errores crudos del proveedor.

#### Scenario: Transporte incierto
- **WHEN** se pierde la respuesta, falta el identificador o cambia el contexto después de iniciar el transporte
- **THEN** se informa resultado incierto y se recomienda verificar Enviados antes de repetir
