## Context

Ver proposal.md. Gemini y OpenAI comparten el ingreso de chat; WhatsApp prepara su propio contexto y Computer Use conserva un cliente aislado por tarea. El arnés Meeting Ops tiene estados y aprobación de minuta específicos que no conviene imponer al resto.

## Goals / Non-Goals

Compartir selección, roles, presupuestos y ejecución concurrente pura. Los workers producen aportes, no llamadas de herramientas. El coordinador de cada superficie sigue siendo el único ejecutor. No introducir un servicio global con estado de usuarios mezclado.

## Decisions

- Módulo TypeScript compartido e independiente de Electron: callbacks de modelo con señal, entradas mínimas y resultados efímeros. Los adaptadores eligen el mismo modelo de su ruta.
- Dos workers concurrentes por solicitud y cuatro llamadas pendientes por proceso. No encolar trabajo opcional; si está ocupado, continuar con el coordinador. Mantener la reserva hasta que la petición real termine, incluso si ignora abort.
- Auto por intención de entregable o análisis complejo; prefijos `modo equipo:` y `modo directo:` fuerzan la elección por turno. Un saludo no dispara workers.
- Contenido y estructura para documentos/presentaciones; análisis y evidencia para páginas; plan y verificación para acciones. El coordinador recibe aportes como datos no confiables, separados de su instrucción de sistema.
- Workers sin herramientas, historial global, memoria ni imágenes implícitas. Solo tarea y texto autorizado del turno; el controlador visual recibe su captura en la llamada original.
- Reusar eventos de actividad de chat y logs de metadatos en main. No persistir aportes ni crear IPC. A diferencia de Meeting Ops, no hay recuperación de workers entre sesiones.
- Computer Use delegado conserva su propia selección. No ampliar su IPC para transmitir un modo global en esta entrega; documentar que una segunda fase puede añadir otro equipo. El modo directo del chat afecta la preparación del chat, no una futura tarea visual independiente.

## Risks / Trade-offs

- Más llamadas pueden aumentar latencia/costo → auto selectivo, modo directo, dos workers, quince segundos y salida acotada; no asegurar mayor velocidad real.
- Inyección y alucinación → sin herramientas; aportes nunca autorizan efectos ni sustituyen evidencia del entorno.
- Proveedor sin cancelación → descartar respuesta tardía y retener cupo hasta resolver.
- Fuentes no disponibles → workers preparan estructura/preguntas, coordinador debe leer fuentes mediante sus guardas normales antes de afirmar hechos.

## Migration Plan

Sin esquema persistido nuevo. Activación automática por intención en los puntos integrados; rollback retirando sus llamadas y el módulo compartido. Meeting Ops conserva el comportamiento anterior.
