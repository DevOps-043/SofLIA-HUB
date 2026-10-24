# Contexto del cambio

- Objetivo: impedir que Gmail envíe un mensaje incompleto o distinto del autorizado y reducir la deuda de seguridad del envío.
- Usuario o actor: usuario autenticado del Hub que envía correo mediante renderer/main; consumidores runtime existentes del servicio Gmail.
- Alcance: contrato de envío compartido, validación cerrada, adjuntos locales acotados, composición MIME mantenida, guarda de sesión/conexión, confirmación nativa del canal gmail:send y resultados sin detalles privados.
- No objetivos: cambiar organización/lectura/etiquetas Gmail, rediseñar autenticación IRIS o ejecutar borrados remotos; certificar todos los canales de correo como endurecidos.
- Restricciones: conservar las cuatro capas, allowlist y modularidad. Sin mensajes reales, secretos, perfiles reales ni nuevas dependencias directas.
- Contratos afectados: Gmail send conserva parámetros y sobre success/messageId/error; añade estado de cancelación/resultado incierto. Un adjunto fallido impide todo envío. No reintentar automáticamente envíos inciertos.
- Riesgo y HITL: alto por divulgación de archivos y envío externo. El canal requiere confirmación nativa ligada a actor, conexión y contenido exacto; guardas antes de transporte. Pruebas usan archivos ficticios y transportes locales/simulados.
- Criterios verificables: rechazo de contexto extraño, destinatarios ambiguos, tipos/tamaños inválidos; confirmación expirada/cancelada/contexto A/B/A no envía; todos los adjuntos o ninguno; archivos regulares, sin enlaces finales ni dispositivos, cuotas por mensaje y lectura incremental; MIME Unicode válido con BCC; éxito sólo con ID de proveedor; sin retry automático tras resultado incierto.
- Incertidumbres: un envío ya recibido por el proveedor no puede deshacerse por cancelar/logout posterior. Declarar incertidumbre sin falso éxito ni afirmar que no se envió. Actualizar Nodemailer a versión corregida antes de reutilizar su compositor; verificar CJS/ESM y consumidor SMTP real local.
