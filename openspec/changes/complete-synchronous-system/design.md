## Context

Hub ya contiene participación y Video SDK; Learning conserva el contrato previo sin participación. Engine genera documentos aprobados, mientras el estudio importa otro formato. Ver motivación en proposal.md.

## Goals / Non-Goals

Cerrar contratos conservando autenticación por organización, CAS e idempotencia. Mantener Meeting y clientes antiguos. No habilitar cuentas, ejecutar migraciones remotas ni afirmar un piloto inexistente.

## Decisions

- Learning conserva el contrato canónico. La ampliación de participación se negocia por cabecera; se elimina de respuestas legacy y el SQL valida cadencia con reloj de base de datos bajo bloqueo de sesión. No confiar en marcas del renderer.
- La entrega de Engine se realiza con preparación estructurada validada y autenticación existente por recurso. Debe conservar revisiones y separar material público de respuestas del facilitador. No aceptar destinos arbitrarios ni secretos desde el navegador.
- Salas Video usan identidad firmada del proveedor y permisos de anfitrión; no correlacionar por nombre visible. Conservar diagnóstico explícito en Meeting cuando no se pueda sincronizar.
- Composición y dispositivos usan APIs públicas; no capturar DOM interno ni audio global del equipo como sustituto de una pista aislada.
- Verificación local incluye contratos, SQL reentrante, errores y recursos; las pruebas de cuenta real permanecen como barrera operativa.

## Risks / Trade-offs

- Versiones cruzadas → negociación y pruebas de cliente anterior.
- Cambios concurrentes → revisión y UUID reutilizado al reintentar.
- Acceso ajeno → revalidación de actor, organización, curso y sesión en cada extremo.
- Efectos audiovisuales parcialmente aplicados → estado visible y reintento idempotente.

## Migration Plan

Publicar backend y migraciones revisadas antes de nuevos clientes. Conservar tablas y archivos en rollback; desactivar funciones nuevas coordinadamente. Validar primero staging con cuentas asignadas y dos aulas. No activar automáticamente producción.
