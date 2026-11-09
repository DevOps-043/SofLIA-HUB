# Corrección de entrada al instructor con API anterior

Fecha: 2026-10-24. Regresión del consumidor HTTP corregida, sin cambios de permisos.

## Causa reproducida
Hub añadía participation_version:1 al cuerpo JSON de todas las operaciones.
La API previa valida studioRequestSchema con strict() y rechaza ese campo.
El error 400 se presentaba como «Learning no autorizó esta operación», compatible
con el aviso de la captura. El fallo ocurría antes de recibir el snapshot del
instructor. No demuestra una falta de rol ni requiere otorgar permisos nuevos.

## Corrección
Main conserva solo organization_slug/session_id/operation en el JSON. Negocia
con cabecera X-Soflia-Studio-Participation:1. La API anterior puede ignorarla;
la nueva la interpreta tras verificar bearer y membresía, y confirma soporte en
snapshot.participation_version:1. Sin confirmación Hub oculta reacciones nuevas
y ajustes de cadencia, manteniendo chat/medios y navegación anteriores.
El cuerpo opcional de la API nueva se conserva para consumidores intermedios.
No hay fallback ante 401/403 ni solicitudes con rol alternativo.

## Evidencia
- Hub: 5 archivos, 58 pruebas aprobadas. Regresión con esquema de petición
  anterior estricto, identidad/sesión correctas, capacidades nuevas, 403 sin
  segundo intento, acceso de instructor/alumno, chat y reconexión.
- Learning: 22 archivos, 138 pruebas aprobadas. Nueva suite de ruta real con
  cabecera ausente/1/desconocida y casos negativos de autenticación/rol/membresía.
- Lint incremental: 9 archivos sin deuda nueva; tsc node, harness, docs y
  diff --check aprobados. Contrato generado sincronizado con Learning.
- verify:pr se detiene exclusivamente en TS2345 previo de
  electron/gmail/raw-message.ts:19 (newline ausente de Options). Sin errores
  nuevos del aula. No se repitió toda la suite general para este cambio dirigido.
- La inspección nativa encontró la ventana Soflia Hub, pero su captura falló
  con error GPU 0x887A0005; no se pulsaron controles a ciegas ni se afirma haber
  verificado el ingreso de la cuenta real. La causa y corrección sí se reprodujeron
  mediante la frontera HTTP y contratos exactos.

No se aplicó SQL, se publicaron cambios, alteraron cuentas ni leyeron secretos.
Actualizar/reiniciar el proceso main de Hub para usar el HTTP corregido: recargar
solo el renderer no reemplaza main. Backend actualizado preparado en rama local;
esta corrección de acceso funciona también con el backend anterior.

Rollback del arreglo no recomendado: reintroduce el JSON incompatible. Revertir
solo la negociación nueva manteniendo el JSON anterior conserva el acceso básico;
mantener ocultas las funciones nuevas hasta confirmación del servidor.
