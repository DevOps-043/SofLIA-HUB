# Contexto del cambio

- Objetivo: activar voz sin repetir aprobaciones ya recordadas ni pedir comandos
  de instalación al usuario.
- Usuario o actor: persona autenticada que abre Orbe o Ajustes de voz.
- Alcance: preparación de Python privado/Vosk pequeño, consentimiento por cuenta,
  estados de espera y errores recuperables.
- No objetivos: cambiar políticas de Windows, Python del sistema, credenciales,
  TTS remoto o permisos runtime de agentes.
- Restricciones: preservar separación main/preload/renderer, caller/sesión,
  guardia nativa, revocación y entrega de eventos por propietario.
- Contratos afectados: DTO de estado voice con campos opcionales setupState y
  setupErrorCode; mismos nueve canales, métodos, aridad y wrappers.
- Riesgo y HITL: instalación básica automática solicitada explícitamente por el
  usuario; captura requiere consentimiento explícito recordado o confirmación
  nativa. Modelo grande y voces opcionales conservan confirmación nativa.
- Criterios verificables: descargas compartidas; no captura al preparar; cancelación
  inmediata; aprobación no cruza cuenta/configuración; detener revoca; Ajustes no
  pide terminal; Orbe no afirma escuchar antes de confirmar inicio.
- Incertidumbres: primer uso real depende de red, políticas del SO y hardware.
  La captura proporcionada no acredita por sí sola un fallo de micrófono.
