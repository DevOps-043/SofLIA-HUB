# Contexto del cambio

- Objetivo: ofrecer las nuevas aulas mediante Zoom Video SDK, con sesiones paralelas, identidad Soflia y grabación automática.
- Actores: instructor y alumno autorizados por Learning; administrador configura la cuenta del proveedor.
- Alcance: contrato discriminado de ingreso, runtime aislado, firma de servidor, programación y cierre por proveedor, importación privada de grabaciones y pruebas coordinadas Hub/Learning.
- No objetivos: crear o comprar cuentas Zoom, leer secretos, desplegar, ejecutar SQL remoto o certificar una llamada real sin cuenta preparada.
- Restricciones: mantener las reuniones existentes en Meeting SDK, la política de grabación y el aislamiento de organizaciones; no fallback silencioso entre proveedores.
- Contratos: operación studio existente; datos de live_sessions y credenciales privadas; proveedor REST y worker de grabaciones.
- Riesgo/HITL: cambio medio-alto de integración; facturación, credenciales y migraciones remotas quedan fuera de las acciones locales autorizadas.
- Aceptación: tokens derivados del actor, sin ZAK para Video SDK; duración de token suficiente para 12 h; audio/video/compartir y desconexión verificables; grabación compuesta y archivo privado; sesiones antiguas compatibles; errores seguros y pruebas negativas.
- Base: Hub f0b18bc, Learning origin/main f918c456 (incluye estudio y grabaciones; el main local estaba atrasado).
- Incertidumbres: cuenta/capacidad Video SDK reales y configuración de grabación deben comprobarse en staging; las pruebas simuladas no acreditan medios reales.
