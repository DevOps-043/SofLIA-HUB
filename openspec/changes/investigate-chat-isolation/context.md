# Contexto de la revisión de aislamiento de chats

Estado: correcciones implementadas y verificadas con los límites del entorno descritos en el reporte. Fecha: 2026-11-14.

- Objetivo: identificar causas verificables de mezcla de contexto, interrupción de agentes y desaparición aparente de conversaciones al navegar.
- Usuario o actor: persona que pidió una presentación sobre calidad y normalización de software y después abrió «Apoyo emocional».
- Alcance: gestor de chats, guardado y carga, Skill/workspace de presentaciones, inicio/cancelación de turnos y equipos runtime.
- No objetivos: generar de nuevo la presentación, cambiar permisos, modificar datos remotos o declarar recuperado un historial sin evidencia.
- Restricciones: preservar el trabajo de voz del checkout principal; no leer secretos ni modificar perfiles de la aplicación.
- Contratos afectados: identidad de conversación/borrador, callback de mensajes, cancelación, asociación del workspace y pertenencia del trabajo a main.
- Riesgo y HITL: revisión y pruebas aisladas sin efectos externos; una recuperación posterior debe verificar propietario, organización y destino antes de escribir.
- Criterios verificables: reproducir defectos con latencia controlada; separar causas confirmadas en código de hipótesis del incidente; registrar controles existentes y límites de recuperación.
- Incertidumbres: fecha e identificadores del incidente, versión ejecutada, estado remoto y ruta concreta de activación de la presentación.

Base: `855192c3`. Rama: `codex/chat-isolation-audit`.

Evidencia inicial: [auditoría histórica](reports/audit.md).
Implementación, pruebas, revisión adversarial y límites: [verificación](reports/verification.md).
