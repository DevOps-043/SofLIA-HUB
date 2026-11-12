# Contexto del cambio

- Objetivo: panel de sesiones minimalista, profesional y adaptable al acceso académico real.
- Usuario o actor: administrador de plataforma, administrador de organización, instructor y alumno autenticados.
- Alcance: próximas sesiones; historial y acceso a gestión para quienes Learning autoriza. Organización activa como ámbito obligatorio. El usuario eligió agenda, historial y gestión el 2026-11-11.
- No objetivos: duplicar formularios y mutaciones del panel Learning, conceder privilegios nuevos por rol recibido del renderer, desplegar o ejecutar migraciones remotas.
- Restricciones: preservar iconografía y cambios locales de carpetas; sin dependencias nuevas; temas y accesibilidad.
- Contratos afectados: catálogo HTTP e IPC existente con período opcional y capacidades negociadas; función live_catalog en SOFIA Learning.
- Riesgo y HITL: lectura académica y enlaces de gestión, sin mutaciones automáticas. Cambios SQL y publicación remotos requieren autorización independiente.
- Criterios verificables: alumno sin historial/gestión; gestores con su ámbito real y navegación al panel existente; fecha filtrada antes de paginar; estados vacíos/error/carga y respuestas tardías; claro/oscuro/ancho reducido sin desbordamiento.
- Incertidumbres: Learning exige membresía activa y no concede privilegios académicos por el solo rol global; se conserva esa política. La etiqueta de administrador de plataforma no suple permisos de la organización.
