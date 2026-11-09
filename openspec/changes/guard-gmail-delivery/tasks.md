## 1. Preparación y dependencia

- [x] 1.1 Registrar línea base de Gmail/calendario/SMTP y audit, revisar contrato y ganchos Nodemailer.
- [x] 1.2 Actualizar Nodemailer corregido sin scripts y verificar lock, instalación y compatibilidad CJS/ESM/SMTP local.

## 2. Envío íntegro

- [x] 2.1 Compartir DTO/schema cerrado y validar destinatarios/cabeceras/cuotas antes de E/S.
- [x] 2.2 Preparar adjuntos acotados y componer MIME real; cubrir errores de archivos, Unicode, BCC y cuotas.
- [x] 2.3 Integrar guardas de conexión y resultado incierto sin retry en el servicio.
- [x] 2.4 Compartir guardas IPC con calendario y exigir confirmación nativa vinculada a gmail:send; cubrir cuatro capas y cancelación/contexto.

## 3. Verificación y entrega

- [x] 3.1 Ejecutar pruebas dirigidas y comparación de auditoría; corregir regresiones.
- [x] 3.2 Actualizar documentación, inventario y plan de deuda.
- [x] 3.3 Ejecutar verify:pr, build aislado y autorrevisión adversarial; guardar evidencia y límites.
