# Contexto del cambio

- Objetivo: evitar confirmaciones repetidas al organizar archivos y corregir el cierre por presupuesto observado en el chat.
- Actor: usuario autenticado del chat de escritorio.
- Alcance: permisos de comandos locales, modal y fallback nativo, organización por extensión entre carpetas y cierre de los loops Gemini/OpenAI.
- No objetivos: permisos WhatsApp, nodos remotos, herramientas dinámicas, migraciones o ejecución sobre archivos reales del usuario.
- Restricciones: mantener separación IPC, políticas main y operaciones deshacibles; sin dependencias nuevas ni aumento del presupuesto.
- Contratos: confirmAction admite opción de recordar; el handler UI admite decisión siempre; batch_move_files admite group_by_extension.
- Riesgo y HITL: cambios de entorno/sistema, comandos compuestos, borrado y envíos conservan confirmación. Recordar sólo un comando exacto con herramienta, carpeta de trabajo y usuario; nunca toda la shell.
- Criterios: movimientos sin modal; recordar un comando sin afectar otro usuario/comando/carpeta; acciones sensibles nunca recordables; cancelación y desmontaje resuelven negativamente; organización de dos fuentes en dos lotes con colisiones y undo; cierre final con herramientas deshabilitadas y sin ejecución adicional al límite.
- Incertidumbre: la captura confirma agotamiento pero no contiene la traza completa. La inspección identifica una respuesta Gemini descartada al límite y ausencia de cierre OpenAI; no se atribuye a una causa exclusiva sin logs.
