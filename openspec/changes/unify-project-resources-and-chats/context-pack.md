# Contexto del cambio
- Objetivo: simplificar archivos y conectar navegador y chat con proyectos.
- Actor: usuario autenticado en su organización activa.
- Alcance: encabezado, cuadrícula, selector Drive, vista previa, páginas y navegación del chat.
- No objetivos: compartir chats automáticamente con colaboradores, mover originales de Drive o cambiar esquemas.
- Restricciones: cuatro capas IPC; rutas acotadas; no almacenar bytes del usuario en Soflia; conservar datos previos y permisos.
- Contratos: ProjectCreationInputs, main/preload/wrapper; pm_project_documents/evidencias; folders y conversations en Lia.
- Riesgo/HITL: mutaciones de referencias mantienen revisión humana; vista previa de sólo lectura sin ejecutar contenido; cuentas y organización se comprueban antes y después de operaciones.
- Criterios: pruebas de unificación, navegación Drive, rechazo de rutas/selecciones ajenas, filtros, guardado desde navegador y chats sin mezcla entre proyectos/organizaciones.
- Incertidumbres: la captura no confirma el error SQL del vínculo; resolver con lectura compatible y espacio personal usando tablas existentes, sin asumir despliegue de la federación.
