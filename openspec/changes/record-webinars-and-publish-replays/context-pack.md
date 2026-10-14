# Contexto del cambio

- Objetivo: grabar los webinars del producto y permitir verlos en Learning únicamente cuando el instructor decida publicarlos.
- Actor: instructor autorizado, alumno con acceso académico vigente y operador de plataforma.
- Alcance: Zoom Meeting SDK actual; backend Learning como custodio; grabación, importación, revisión y reproducción privada.
- Restricción confirmada: grabar y publicar son decisiones independientes. El instructor no decide si se graba; decide acceso posterior.
- Cobertura propuesta: eventos académicos de Soflia que el producto llama webinars, soportando ambos tipos Zoom meeting/webinar; excluye otras reuniones de la cuenta maestra. Ratificar clasificación en la fase de preflight.
- No objetivos: grabador Electron, bots, Meet/Teams como proveedores adicionales, cámara virtual, transcripción/IA y publicación por defecto.
- Contratos: programación e inicio Zoom; webhook firmado; ledger/cola/worker; catálogo académico; URLs de vídeo firmadas; estado SDK y wrapper tipado Hub.
- Riesgo: licencia/cuota o E2EE incompatibles; grabación interrumpida; callbacks perdidos/duplicados; importación parcial; acceso entre organizaciones; publicación de un ensayo; archivos grandes; retención de vídeos no publicados.
- HITL: configuración remota de Zoom, scopes, secretos, migraciones, despliegue y purgas requieren autorización posterior. Esta tarea solo investiga y escribe el plan.
- Criterios: grabación automática verificada, ausencia de publicación implícita, captura conservada si sale Hub mientras Zoom sigue activo, importación reintentable, fragmentos completos, alumno ajeno rechazado y eventos previos auditados.
- Incertidumbres: permisos/licencias/cuotas efectivas de la cuenta, almacenamiento contratado, volumen y duración, política de retención, flujo Webinar real del SDK, layouts y ensayo previo. Se resuelven en la primera fase; no se afirman disponibles.
- Estado Git: trabajo previo y cambios concurrentes conservados. Solo se agregan artefactos de planificación en este cambio.
- Fecha de investigación: 2026-10-13. Fuentes y observaciones: [investigación](research.md).
