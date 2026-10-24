## Context
Learning autoriza el aula y custodia las credenciales. El Hub ejecuta Meeting SDK en un iframe aislado. Las grabaciones existentes se importan mediante trabajos privados y reconciliación REST. Las sesiones históricas deben conservar su proveedor.

## Goals / Non-Goals
Integrar Video SDK para nuevas aulas, identidad Soflia, sesiones simultáneas y grabación compuesta. Conservar Meeting SDK y el control de acceso existente. No contratar servicios, modificar secretos, desplegar ni ejecutar SQL remoto.

## Decisions
- Guardar el proveedor por sesión; la configuración del servidor selecciona el de nuevas programaciones. Ausencia de proveedor significa Meeting SDK durante la transición.
- Emitir JWT de Video SDK exclusivamente en Learning, derivando rol, usuario y nombre de sesión del aula autorizada. No aceptar roles del cliente ni compartir credenciales API.
- Usar el runtime aislado actual con adaptadores separados. Video SDK ofrece controles en español y libera cámara, micrófono y pantalla al salir.
- Crear las sesiones Video por REST con grabación automática cloud verificada. Mantener credenciales y referencia remota en tablas privadas con RLS sin acceso cliente.
- Reconciliar grabaciones Video por REST y reutilizar la importación privada, validando proveedor, sesión y archivos antes de descargarlos. No incorporar webhooks nuevos.
- Implementar primero en worktrees aislados coordinados de Hub y Learning. Sincronizar el contrato canónico de Learning mediante el script existente.

## Risks / Trade-offs
La grabación requiere habilitación y consumo facturable de la cuenta Video SDK. La activación permanecerá explícita y rechazará una configuración incompleta. Los navegadores y Electron requieren validar permisos y recursos audiovisuales. Las pruebas locales no sustituyen una prueba con la cuenta real.

## Migration / Rollback
Aplicar la migración aditiva antes de habilitar el proveedor. Configurar las credenciales en el entorno del servidor y validar una sesión de prueba antes de activar nuevas aulas. Deshabilitar la selección de Video conserva el proveedor de aulas existentes; no convertir ni borrar sesiones o grabaciones.
