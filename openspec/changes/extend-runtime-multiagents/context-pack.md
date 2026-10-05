# Contexto del cambio

- Objetivo: extender la colaboración runtime a las superficies operativas.
- Actor: usuario autenticado en chat/WhatsApp y llamadores ya autorizados de Computer Use.
- Alcance: especialistas paralelos sobre datos ya autorizados; coordinador existente materializa y verifica los resultados.
- No objetivos: nuevos permisos, sesiones compartidas, escrituras concurrentes ni cambios en aprobaciones.
- Restricciones: español, sin secretos en logs, límite temporal y cancelación, mismo proveedor/modelo de la superficie.
- Contratos: opciones internas del turno y eventos de progreso existentes; sin nuevos canales IPC.
- Riesgo/HITL: los aportes son datos no confiables. Nunca constituyen evidencia de ejecución ni autorización.
- Criterios: dos especialistas solapados; fallos aislados; cero herramientas en especialistas; límites globales por proceso; cancelación sin resultados tardíos; integración comprobada por superficie.
- Incertidumbres: rapidez y calidad reales requieren evaluación facturable. Se medirá concurrencia local y se registrará esta brecha.
