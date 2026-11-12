# Contexto del cambio

- Objetivo: administración básica de organización y ajuste del acceso inferior solicitado por el usuario.
- Actor: miembro activo con rol owner o admin en la organización seleccionada.
- Alcance: datos generales, logo/icono PNG/JPEG/WebP de hasta 2 MiB, enlaces HTTPS y colores hexadecimales; guardado explícito y errores recuperables.
- No objetivos: facturación, planes, eliminación, membresías, SSO, permisos runtime y edición del tema de toda la aplicación.
- Restricciones: preservar cambios concurrentes; sin secretos ni service role; base compartida con Learning sin modificar grants/RLS de tablas existentes.
- Contratos: organizations y organization_users ya verificados mediante consultas de metadatos; RPC nueva y bucket específico de identidad visual.
- Riesgo/HITL: Guardar inicia la mutación humana; aplicar la migración remota requiere autorización aparte.
- Criterios: no visible para miembros/suspendidos, RPC rechaza actor equivocado y claves fuera de allowlist; un cambio de usuario/organización descarta resultados tardíos.
- Incertidumbres: migración no desplegada y permisos remotos no certificados por pruebas locales; estado de despliegue debe mostrarse con error y reintento.
