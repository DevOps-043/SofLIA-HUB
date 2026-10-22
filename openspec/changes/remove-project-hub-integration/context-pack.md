# Contexto del cambio

- Objetivo: retirar las integraciones de Project Hub/IRIS antes del rediseño.
- Actor: usuario de Soflia Hub.
- Alcance: UI externa, REST, IPC, autenticación Project Hub, herramientas runtime, sincronización de reuniones y arranque.
- No objetivos: implementar la fusión futura; modificar Project Hub, carpetas o datos almacenados.
- Restricciones: preservar trabajo ajeno, identidad SOFIA y persistencia Lia.
- Contratos afectados: project-hub:*, meeting:get-context, meeting:sync-approved-actions y herramientas IRIS.
- Riesgo y HITL: retirada de código expresamente solicitada; sin acciones sobre datos o servicios remotos.
- Criterios: sin acceso Project Hub en UI, IPC o agentes; carpetas y chats operativos; comprobación de tipos y pruebas proporcionales.
- Incertidumbres: no se asume acceso a servicios remotos; las migraciones existentes se conservan como historial.
