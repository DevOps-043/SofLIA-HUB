# Investigación de agentes y diagnóstico de PulseHub

Estado: investigación para una propuesta; no acredita nuevas capacidades implementadas.
Consulta: 2026-10-11. Se usaron documentación oficial y código local. La disponibilidad comercial depende del plan, la plataforma, el despliegue gradual y las políticas del espacio de trabajo.

## Capacidades documentadas

| Producto o mecanismo | Funcionamiento documentado | Patrón útil para PulseHub |
| --- | --- | --- |
| ChatGPT Chat | Conversación para preguntas, investigación, ideas y borradores; permite añadir contexto y herramientas. Work se presenta como la vía para llevar una tarea mayor a un resultado revisable. [Fuente oficial](https://learn.chatgpt.com/docs/use-chatgpt) | Distinguir una respuesta de un trabajo que exige ejecución y un entregable |
| ChatGPT Work | Usa archivos, plugins y herramientas aprobadas para crear archivos y ejecutar flujos. Permite seguir el progreso, cambiar la dirección y aprobar acciones. Work con coordinación en nube puede acceder a recursos locales mediante un equipo conectado; estos pasos requieren que el equipo esté disponible. [Fuente oficial](https://learn.chatgpt.com/docs/get-started-with-work) | Objetivo, ejecución con herramientas, resultado y continuidad con límites locales explícitos |
| ChatGPT dots | Puede repartir trabajo entre agentes de fondo en paralelo mientras continúa la conversación. Cada tarea recibe contexto seleccionado y tiene su propia conversación. Las tareas locales dependen del equipo conectado; las tareas de nube compatibles pueden seguir sin él. Esta capacidad no se atribuye automáticamente a cualquier chat de ChatGPT. [Fuente oficial](https://learn.chatgpt.com/docs/dots/tasks-and-memory) | Coordinador estable, delegación real y tareas con identidad y contexto propios |
| Claude y Cowork | La nueva experiencia está unificando chat y tareas en una conversación, con despliegue gradual. Claude decide entre una respuesta breve y una tarea; admite varias tareas, herramientas y archivos terminados. [Fuente oficial](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude) | Activar ejecución por el resultado solicitado, sin exigir una palabra especial |
| Claude Cowork | Documenta coordinación de subtareas en paralelo, acceso local y creación de documentos, hojas con fórmulas y presentaciones. [Fuente oficial](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork) | Agentes con capacidades y entregables concretos, incluyendo verificación de archivos |
| Claude Cowork en nube | Desde el 6 de octubre de 2026 las nuevas tareas Pro/Max se ejecutan en nube; las tareas locales anteriores permanecen locales. La ejecución remota puede continuar con el portátil cerrado, pero acceder a carpetas y herramientas locales exige Claude Desktop abierto. Team/Enterprise tienen condiciones adicionales de beta y administración. [Fuente oficial](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile) | Separar dónde vive el trabajo de dónde está el recurso; evitar confundir fondo local con ejecución remota |
| Claude Code: subagentes | Los subagentes tienen contexto y herramientas configurables. En fondo ejecutan concurrentemente y las peticiones de permiso aparecen en la sesión principal identificando al solicitante. Los resultados llegan por notificación de finalización. [Fuente oficial](https://code.claude.com/docs/en/sub-agents) | Herramientas por agente, permisos comprensibles y notificación basada en resultados reales |
| Claude Code: equipos | Líder, compañeros con contexto independiente, tareas compartidas y mensajes entre agentes. La función sigue siendo experimental y está desactivada por defecto; añade coste de coordinación y tokens y tiene límites de recuperación. [Fuente oficial](https://code.claude.com/docs/en/agent-teams) | Dependencias y propiedad de tareas; usar equipos cuando las subtareas pueden avanzar independientemente |

Los productos documentan su comportamiento visible; sus arquitecturas internas completas no son públicas. El diseño siguiente es una recomendación propia para PulseHub, no una reproducción de código interno ni una integración automática con sus suscripciones.

## Patrones de implementación documentados

OpenAI distingue el coordinador que invoca especialistas y conserva la respuesta final de los traspasos que cambian el propietario de la conversación. Recomienda añadir especialistas cuando mejoran aislamiento de capacidad, políticas o claridad. Para PulseHub se recomienda el primer patrón, con ejecutores propios y control de trabajos en main. [Orquestación oficial](https://developers.openai.com/api/docs/guides/agents/orchestration).

El modo `background` de Responses ejecuta una respuesta de modelo de forma asíncrona y permite consultar su estado. Implica retención temporal para consulta según las condiciones documentadas. **Inferencia técnica:** activar ese parámetro por sí solo no construye la cola de PulseHub, el ejecutor de herramientas locales, la coordinación entre agentes ni la recuperación de efectos externos. [Background mode](https://developers.openai.com/api/docs/guides/background).

La complejidad multiagente incorpora decisiones adicionales de selección, transferencia y herramientas. Su adopción debe apoyarse en evaluaciones. La propuesta exige comparar resultado, coste y latencia con un único ejecutor sobre los mismos casos. [Evaluaciones oficiales](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Diagnóstico confirmado en el repositorio

Inspección del checkout local el 2026-10-11, con base Git `72da2fd` y cambios locales presentes. Los enlaces apuntan al código inspeccionado; no describen un commit publicado de esta propuesta.

| Área | Evidencia local | Consecuencia |
| --- | --- | --- |
| Equipos del chat | [Política](../../../../src/shared/agent-teams/policy.ts), [runner](../../../../src/shared/agent-teams/runner.ts) y [adaptador](../../../../src/services/gemini-chat/agent-team.ts): dos trabajadores, una generación por trabajador, 15 segundos y 1500 tokens de salida | No hay ciclo de herramientas por especialista ni tareas operativas largas |
| Autoridad | La instrucción del coordinador reserva las herramientas al coordinador; el adaptador de cada trabajador no declara herramientas | Ampliar prompts o cambiar el modelo no basta para delegar ejecución |
| Flujo del chat | [Pipeline](../../../../src/services/gemini-chat/send-message-stream.ts) espera `prepareChatTeam` antes de la respuesta del coordinador | El equipo está unido al turno y a su cancelación; no constituye un servicio de trabajos independiente |
| Arnés de reuniones | [Servicio](../../../../electron/agent-runtime/service.ts) inicia ejecución en main y revalida alcance; [herramientas](../../../../electron/agent-runtime/tools.ts) limitadas a transcripción, evidencia y aportes | Existe un patrón aprovechable, pero no un ejecutor general de trabajo operativo |
| Recuperación | [Repositorio](../../../../electron/agent-runtime/repository.ts) cifra y guarda de forma atómica; `recover` del servicio inicia otra ejecución | Reutilizar el patrón de almacenamiento, diseñando recuperación por subtarea; actualmente no continúa un punto de ejecución arbitrario |
| Herramientas existentes | [Archivos](../../../../src/services/gemini-tools/computer-file-tools.ts), [workspace](../../../../src/services/gemini-tools/skill-workspace-tools.ts) y [catálogo del turno](../../../../src/services/gemini-tools/turn-catalog.ts) | Ya existen declaraciones para lectura y creación de Word y archivos; su invocación por ejecutores en main exige adaptación y guardas, no copiar el catálogo completo |
| Monitor | [Panel](../../../../src/components/agents/AgentActivityPanel.tsx) y [actividad](../../../../src/services/agent-activity.ts) | Aprovechar la ventana flotante y los estados reales, añadiendo operaciones y artefactos procedentes del nuevo servicio |

## Conclusión de diseño

La mejora propuesta requiere un gestor de trabajos y agentes que ejecuten herramientas bajo permisos acotados. Aumentar el número de llamadas de análisis o dibujar más tarjetas no aporta esas capacidades. La ejecución local persistente es el primer incremento; una infraestructura remota sería otro proyecto con contratos propios.
