## Why

Un proyecto debe tener identidad estable y colaboración en Soflia sin depender de una ruta fija o del equipo de su creador. El usuario necesita elegir dónde viven sus archivos y trasladar o importar/exportar un proyecto completo, manteniendo su referencia en base de datos sin otorgar permisos por un archivo importado.

## What Changes

- Crear un espacio de archivos por proyecto en una carpeta elegida explícitamente; conservar intactas las carpetas de chats existentes.
- Admitir almacenamiento local, carpetas de OneDrive/Google Drive gestionadas por sus clientes de escritorio y conexión directa a ambas APIs. Ambas modalidades forman parte del alcance confirmado.
- Separar proyecto lógico, raíz compartida de archivos y vínculo local privado por usuario/dispositivo. Una ruta absoluta nunca será la identidad del proyecto.
- Incorporar manifiesto portable versionado, inventario de archivos y paquete de exportación/importación con revisión, hashes y migraciones de formato.
- Compartir proyecto, tareas y archivos mediante membresía de proyecto y permisos efectivos de almacenamiento. No compartir el escritorio del propietario.
- Añadir aprovisionamiento idempotente, diario persistente, recuperación de efectos parciales, revisiones, cola offline y resolución visible de conflictos.
- Abrir cada proyecto en un apartado propio dentro de la interfaz principal, distinto del chat, sin pestañas ni ventanas nuevas. Navegación vertical para resumen, tareas, archivos, páginas web, chats vinculados, hitos, ciclos, equipos, métricas y actividad.
- Presentar relaciones autorizadas y métricas trazables; los módulos opcionales muestran ausencia, falta de acceso o capacidad pendiente sin inventar datos ni convertir la asociación en permiso.
- Replicar el lateral flotante real del Hub: margen exterior, bordes redondeados, superficie translúcida, sombra suave, colapso y ajuste de ancho. Incluir Nuevo chat, búsqueda contextual, icono de navegador y chats recientes del proyecto.
- Los chats nuevos creados dentro del proyecto, incluido su navegador, se guardan asociados al proyecto desde su creación; la pertenencia no publica automáticamente una conversación privada.
- Extender la API existente para estas operaciones; los nombres y entidades nuevos del diseño son propuestas, no contratos desplegados.
- **BREAKING**: la creación portable no debe activar la creación automática heredada de carpeta Lia ni usar clientes IRIS directos. Conciliar primero la retirada a7d705c con el trabajo de seguridad actual antes de elegir la base de implementación.

No objetivos: implementar código en esta entrega, mover proyectos o carpetas existentes, aplicar SQL remoto, sustituir los clientes de sincronización de nube, sincronizar simultáneamente el mismo árbol por dos motores, exponer shell/Git a agentes runtime o implementar coedición tipo Google Docs.

## Capabilities

### New Capabilities

- `portable-project-storage`: ubicación elegida, identidad, vínculos locales, aprovisionamiento recuperable y apertura del espacio de proyecto en la interfaz principal.
- `project-portability`: manifiesto, paquetes, exportación selectiva e importación segura con modos explícitos.
- `project-collaboration`: colaboración en proyecto/tareas/archivos y permisos separados de proyecto/proveedor.
- `project-storage-sync`: proveedores directos, clientes de escritorio, revisiones, trabajo offline y conflictos sin pérdida silenciosa.

### Modified Capabilities

Ninguna especificación vigente consolidada bajo `openspec/specs/` se modifica en esta propuesta. Los cambios activos anteriores se reconcilian como dependencia de implementación; no se presentan como completados.

## Impact

- Electron main/preload/renderer: servicios de proyecto y almacenamiento, selectores nativos/proveedor, contratos IPC tipados y experiencia de creación/apertura/traslado/importación/colaboración; navegación del proyecto sin pestañas, con cargas por sección y permisos por recurso.
- Project Hub API/IRIS: extensión de identidad portable, vínculos de almacenamiento compartido, membresías, revisión e idempotencia transaccional. Requiere trabajo posterior autorizado en el repositorio servidor.
- Lia: las conversaciones y carpetas conservan su dominio; su vinculación explícita al proyecto forma parte del alcance y no mueve datos ni comparte chats personales automáticamente.
- Panel: comprobar y extender los contratos de hitos, ciclos, equipos y analítica; un endpoint analítico o un team_id principal no prueban soporte de todo el panel.
- Persistencia local: índice privado de ubicaciones y diario de operaciones/cola fuera de las carpetas sincronizadas.
- Google/Microsoft: OAuth incremental y custodia por usuario/cuenta; validación con cuentas personales y empresariales antes de liberar cada capacidad.
- Calidad: pruebas entre usuarios/dispositivos, fallos parciales, archivos externos, formatos maliciosos y respaldo/rollback sin pérdida de datos.

Diseño en [design.md](design.md), secuencia en [tasks.md](tasks.md) y explicación de producto en [plan.md](plan.md).
