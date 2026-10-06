# Contexto del cambio

- Objetivo: recuperar inicio de Huddle, ventana y registro real en Google Chat.
- Actor: usuario del navegador integrado con sesión Google autenticada.
- Alcance: navegación de Meet, ventanas hijas gobernadas y runtime estable comprobado.
- No objetivos: fallback `/new`, navegador externo, manipulación de SDP o concesiones de permisos.
- Restricciones: preservar cambios ajenos, sesión, aislamiento y mínimo privilegio.
- Contratos afectados: política de navegación/ventanas, sin canales IPC nuevos.
- Riesgo y HITL: la prueba puede llamar a terceros; Alexis y DevOps autorizados
  expresamente. Google mantiene su control de inicio y permisos del usuario.
- Criterios: iframe y redirección no cancelados por marca de sitio; popup nativo
  adoptado antes de devolverlo; protocolos y política empresarial respetados;
  no creación de pestañas/reuniones por lógica de SofLIA; cierre y regresiones.
- Evidencia inicial: el paquete instalado era 44.0.0-beta.3 aunque el manifiesto
  fijaba 43.4.0. La prueba devolvía StartupCode 219, incluso con 44.5.1 estable.
  Tras ocultar DocumentPictureInPictureAPI aparecen tarjeta y panel de llamada.
  La instalación se alinea con 44.5.1 estable comprobado.
