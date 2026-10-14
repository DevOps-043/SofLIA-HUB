# Contexto del cambio

Estado: propuesta; sin implementación. Investigación realizada el 2026-10-11.

- Objetivo: convertir los especialistas de SofLIA en agentes que ejecuten subtareas con herramientas y produzcan resultados verificables en segundo plano.
- Usuario o actor: persona autenticada en Soflia Hub, dentro de su organización, proyecto y conversación de origen.
- Alcance: propuesta de equipos ejecutores, ciclo de vida independiente del renderer, herramientas por rol, persistencia, artefactos, monitor y recuperación. El primer incremento implementable se limita al chat y a investigación y creación de archivos en un espacio autorizado.
- No objetivos: implementar esta propuesta durante la investigación; habilitar publicación automática; compartir permisos con agentes de desarrollo; prometer ejecución con el equipo apagado sin infraestructura remota; ampliar automáticamente las fuentes de un documento adjunto.
- Restricciones: español; separación main/preload/renderer; permisos comprobados en cada ejecución; presupuestos acotados; conservación de cambios ajenos; respeto a las restricciones por superficie y a las acciones que requieren intervención humana (HITL).
- Contratos afectados: futuros contratos de tarea, agente, capacidad, artefacto, aprobación y evento; nuevas operaciones IPC por las cuatro capas; adaptación del monitor y del inicio de trabajos desde chat. Los nombres descritos en el diseño son candidatos, no canales existentes.
- Riesgo y HITL: conflictos de archivos, pérdida de sesión, efectos externos duplicados y filtración entre organizaciones. Escritura externa, envío y acciones críticas requieren aprobación sobre el resultado concreto y su destino; no sobre un permiso genérico para que el equipo haga cualquier cosa.
- Criterios verificables: dos agentes ejecutan herramientas reales, el chat sigue disponible, se abren los archivos producidos, se conserva el estado al reiniciar y se evita repetir efectos ambiguos. Escenarios detallados en la especificación.
- Incertidumbres: cobertura real de cada herramienta al invocarla desde main; formatos documentales disponibles sin shell general; límites eficientes de concurrencia; coste por tarea; arquitectura y política de alojamiento para una fase remota. Resolver con inventario, prototipo y evaluaciones, no mediante supuestos de capacidad.
