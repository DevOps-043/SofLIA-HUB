# Codex aplicado a resultados útiles en SofLIA

Estado: investigación y propuestas; no modifica el runtime.
Fecha: 2026-09-25. SofLIA inspeccionada: commit 9c73dd7.
Codex inspeccionado: [782826663df3e898d0c594a13f6f75cc2a498644](https://github.com/openai/codex/commit/782826663df3e898d0c594a13f6f75cc2a498644), fechado 2026-09-25T19:48:25Z.

## Criterio de valor

Priorizar trabajos que el usuario pueda terminar, archivos que pueda utilizar,
tiempo de espera y correcciones que pueda evitar. La prioridad de este informe
es una recomendación de ingeniería basada en rutas reales del código; no es una
medición de frecuencia de uso ni un estudio con usuarios.

Se leyeron fuentes de Codex mediante git show y se contrastaron con los flujos
de SofLIA. No se ejecutó Codex, no se invocaron modelos ni se midieron latencias.
Se reprodujo de forma aislada la salida de límite del loop de WhatsApp con sus
dependencias sustituidas por funciones simuladas, sin mensajes ni efectos externos.
La investigación técnica extensa permanece en el
[informe del repositorio](codex-repository-research-2026-09-21.md).

## Hallazgos que cambian la prioridad

| Evidencia en SofLIA | Consecuencia para quien la usa |
|---|---|
| [agent-loop.ts](../../electron/wa-agent/agent-loop.ts) devuelve una frase de éxito al salir del límite de 25 iteraciones | Una tarea que agota iteraciones puede presentarse como completada sin haber comprobado su objetivo |
| [html-generator.ts](../../electron/presentation-workflow/html-generator.ts) pide un deck completo, valida JSON y exporta; no tiene un ciclo de reparación visual | Una presentación válida estructuralmente puede requerir correcciones de legibilidad o composición por parte del usuario |
| [runner.ts](../../src/shared/agent-teams/runner.ts) pasa solicitud y fuente a workers sin herramientas | Dos especialistas generales no equivalen a dos investigadores que consultan fuentes distintas |
| Los ejecutores de [Gemini](../../src/services/gemini-chat/agentic-loop.ts), [OpenAI](../../src/services/openai-chat/send-message-stream.ts) y [WhatsApp](../../electron/wa-executor/tool-loop.ts) esperan cada función en un for | Las lecturas independientes solicitadas en un mismo lote no aprovechan concurrencia en esas rutas |
| [ChatInputArea.tsx](../../src/adapters/desktop_ui/chat-ui/ChatInputArea.tsx) deshabilita entrada mientras muestra carga y ofrece detener | En esa interfaz no se puede introducir una corrección durante la ejecución sin detenerla o esperar |

Salvo la reproducción del límite de WhatsApp, estos hallazgos son estáticos.
No prueban que todas las tareas fallen, que una
presentación concreta sea ilegible ni que cierta operación tarde un tiempo dado.
WhatsApp ya tiene guardas de evidencia, repetición y fallos: el defecto específico
es la salida al agotar iteraciones, que evita esas decisiones de finalización.

## 1. Entregar tareas completas y comprobadas

**Ejemplo:** «Busca la propuesta del cliente en Drive, prepara un resumen y
déjame el archivo listo para compartir por WhatsApp».

**Resultado deseado:** SofLIA encuentra la fuente correcta, produce un archivo
abrible y comunica qué terminó y qué falta. Si se requiere aprobación para
compartirlo, conserva ese paso y no confunde borrador con envío.

**Qué aporta Codex:** el
[runtime de objetivos](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/ext/goal/src/runtime.rs)
mantiene un objetivo y controla continuación y estados; su
[instrucción de continuación](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/ext/goal/templates/goals/continuation.md)
exige contrastar requisitos con evidencia actual antes de declararlo logrado.
Esa instrucción no es un verificador automático de documentos. SofLIA debe
implementar comprobadores propios de archivo, fuente y resultado de cada servicio.

**Adaptación propuesta:** conservar el pedido original y una lista de resultados
esperados; registrar IDs de fuentes, archivos y operaciones. Tras cada etapa,
comprobar sus condiciones de éxito. Permitir reparación acotada de pasos locales
reversibles; tratar envíos de resultado incierto mediante consulta, sin repetirlos
a ciegas. Al agotar presupuesto, devolver resultado parcial verificable.

**Primer arreglo con valor inmediato:** sustituir la confirmación incondicional
al final del loop de WhatsApp por estado de límite alcanzado y avances confirmados.
Es una corrección propuesta, todavía no aplicada en esta investigación.

**Reproducción local:** se leyó agent-loop.ts sin modificarlo, se transpiló con
TypeScript y se evaluó en un contexto VM con todos sus imports reemplazados.
El handler de herramientas simulado devolvió done=false en cada iteración.
Resultado observado: 25 invocaciones y respuesta «He completado las acciones
solicitadas». Esto demuestra la salida incorrecta al agotarse el loop; no prueba
la frecuencia del escenario ni ejercita los servicios o guardas internos reales.

**Demostración exigida:** forzar el límite antes de crear un archivo; la respuesta
no debe afirmar creación ni envío. En el caso exitoso se debe abrir el archivo y
contrastar su contenido con el pedido, no solo verificar que existe una ruta.

## 2. Presentaciones revisadas y corregidas antes de entregarlas

**Ejemplo:** «Con este informe crea ocho diapositivas para dirección con la
marca de la empresa, conclusiones y recomendaciones».

**Lo que ya existe:** contrato declarativo de deck, identidad de marca, límites
de tamaño y exportación HTML. El
[exportador](../../electron/skill-workspace/export-html.ts) también comprueba
recursos de imágenes declarados. No hace falta reconstruir esa base.

**Qué aporta Codex:**
[salida estructurada en app-server](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/app-server/tests/suite/v2/output_schema.rs)
y [lectura de imágenes por el modelo](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/core/src/tools/handlers/view_image.rs).
Son piezas para un ciclo de generar, observar y corregir; no un generador de
presentaciones empresarial terminado. La prueba de esquema se leyó, no se ejecutó.

**Adaptación propuesta:** generar → validar deck → renderizar cada diapositiva →
medir texto fuera de límites y elementos ausentes → revisión visual y de contenido
→ corregir solo diapositivas señaladas → volver a comprobar → exportar.
La revisión de contenido contrasta cifras con la fuente; la visual recibe capturas
reales con IDs de diapositiva. Debe haber un límite de correcciones y salida parcial
si persisten defectos, sin declarar aprobación visual por una simple respuesta JSON.

Las revisiones pueden ejecutarse en paralelo una vez que existe el mismo borrador.
El revisor no debe inventar una evaluación de una diapositiva que todavía no vio.
El contrato de JSON restringe estructura, no garantiza exactitud ni legibilidad.

**Demostración exigida:** casos con título largo, tabla densa, imagen ausente,
cifra contradictoria y marca no disponible. El sistema identifica el problema,
corrige cuando puede y conserva el resto del deck. Comparar correcciones humanas
requeridas frente al generador actual. El flujo WhatsApp actual exporta HTML;
esta propuesta no implica soporte PPTX ni DOCX que ese exportador no tiene.

## 3. Especialistas que obtienen información útil

**Ejemplo:** «Compara estos tres proveedores, consulta sus condiciones actuales y
crea una recomendación con fuentes y una presentación».

**Brecha:** el equipo general actual analiza el material proporcionado. No tiene
herramientas para visitar las tres fuentes. Un segundo prompt sobre el mismo
fragmento no sustituye la investigación que falta.

**Qué aporta Codex:** [spawn V2](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs)
crea tareas hijas con contexto y relación con el padre; la
[configuración del hijo](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/core/src/agent/child_config.rs)
aplica rol y políticas efectivas. No proporciona por sí misma permisos de Drive,
WhatsApp o de la organización de SofLIA.

**Adaptación propuesta:** encargos separados por fuente o pregunta. Un investigador
obtiene condiciones; otro compara prestaciones; después, un revisor comprueba la
recomendación contra la evidencia reunida. Entregan referencia, fecha de consulta,
dato extraído y limitaciones. Usar una lista pequeña de herramientas de lectura
autorizadas, reutilizando el patrón que ya tiene
[Meeting Ops](../../electron/agent-runtime/tools.ts).

En navegador, las lecturas de páginas independientes pueden repartirse en contextos
aislados. Las operaciones sobre una sesión visible o el escritorio compartido
conservan un solo controlador. La generación final espera la evidencia necesaria;
no todos los pasos son paralelizables.

**Demostración exigida:** cada afirmación importante apunta a una fuente realmente
leída; se detectan discrepancias y fuentes inaccesibles. Medir cobertura correcta
y errores de atribución frente al equipo actual, además del tiempo.

## 4. Menos espera al preparar reuniones y resúmenes

**Ejemplo:** «Prepárame para la reunión de las cuatro: qué acordamos, los últimos
correos del cliente y los documentos relacionados».

**Qué aporta Codex:** [parallel.rs](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/core/src/tools/parallel.rs)
distingue herramientas que permiten ejecución paralela y las demás. La exclusión
de ese componente no es un bloqueo global de todos los recursos empresariales.

**Adaptación propuesta:** leer correo, agenda y documentos concurrentemente cuando
ya se conocen los identificadores necesarios. Mantener orden de resultados por
call_id y errores independientes. No paralelizar buscar un ID y usarlo antes de
obtenerlo, ni varias acciones sobre el mismo navegador o archivo.

Esta mejora puede aportar rapidez sin invocar un especialista adicional para cada
consulta. Si dos herramientas dependen de una tercera, se ejecutan por etapas.
Las guardas y aprobaciones siguen aplicándose a cada llamada.

**Demostración exigida:** con servicios simulados comprobar solapamiento de lecturas
independientes y orden correcto de dependencias; con casos reales medir latencia
total y éxito. No se ofrece una cifra de aceleración antes de medirla.

## 5. Corregir el pedido mientras SofLIA trabaja

**Ejemplo:** durante una presentación, escribir «Hazla para clientes, máximo cinco
diapositivas y sin precios» sin volver a empezar toda la conversación.

**Qué aporta Codex:** el contrato
[TurnSteerParams](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/app-server-protocol/schema/typescript/v2/TurnSteerParams.ts)
identifica thread y turno esperado; sus
[pruebas](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/app-server/tests/suite/v2/turn_steer.rs)
incluyen rechazo sin turno activo. Esto permite dirigir trabajo existente con una
precondición explícita, en vez de iniciar otra tarea concurrente por accidente.

**Adaptación propuesta:** entrada de corrección asociada a taskId y versión del
pedido. Incorporar cambios en el siguiente punto seguro y descartar resultados
de especialistas que contradigan la nueva versión. Mostrar acuse de recepción y
después confirmación de aplicación. Los borradores válidos pueden conservarse.

Para nuestros loops propios hace falta cola de entrada y reconciliación. El
endpoint app-server no se puede llamar sobre una sesión Gemini ni sobre nuestra
sesión HTTP de Responses. La
[documentación oficial de steering](https://developers.openai.com/api/docs/guides/steering)
describe otra ruta mediante WebSocket para GPT-6; no revierte acciones ni cancela
herramientas que ya comenzaron. Adaptar el contrato exige trabajo en transporte y UI.

**Demostración exigida:** corregir mientras un worker está respondiendo; la salida
final cumple el nuevo pedido y no mezcla precios retirados. Si un envío ya ocurrió,
la UI informa ese hecho sin fingir que la corrección lo deshizo.

## 6. Elegir bien cómo resolver el pedido

**Ejemplo:** «Cambia mi reunión al jueves y prepara el material». Si Calendar está
conectado, la reprogramación debe usar el servicio correspondiente; la consulta
de documentos usa Drive y la creación usa el generador. El escritorio se reserva
para partes que realmente requieren una aplicación visible.

**Qué aporta Codex:** [tool_search.rs](https://github.com/openai/codex/blob/782826663df3e898d0c594a13f6f75cc2a498644/codex-rs/core/src/tools/handlers/tool_search.rs)
descubre herramientas diferidas a partir de sus metadatos. No busca documentos ni
decide permisos. Las [skills oficiales](https://developers.openai.com/plugins/concepts/skills)
aportan procedimientos que combinan herramientas para completar pedidos reconocibles.

**Lo que ya existe:** SofLIA filtra herramientas por superficie y Skill en
[model-config.ts](../../src/services/gemini-chat/model-config.ts); también tiene
fallback entre lectura web, navegador y Computer Use. La propuesta es mejorar
la selección contextual y probarla, no agregar otro catálogo de ajustes.

**Adaptación propuesta:** descubrimiento sobre herramientas ya autorizadas y
procedimientos pequeños para preparar reunión, generar propuesta y dar seguimiento.
La disponibilidad real de la conexión determina la ruta. La búsqueda en sí añade
una llamada: solo merece la pena donde reducir el catálogo mejora los resultados.

**Demostración exigida:** pedidos equivalentes con y sin conexión Calendar/Drive;
se elige una ruta disponible y se completa la operación sin pedir al usuario que
conozca nombres internos de herramientas. Medir selecciones equivocadas y pasos
innecesarios; no asumir ahorro automático de tokens.

## Orden de entrega recomendado

1. Corregir falsa finalización al agotar iteraciones y definir comprobación del
   resultado para una tarea frecuente de WhatsApp. Beneficio: confianza en lo que
   SofLIA afirma haber hecho.
2. Completar generación, revisión y reparación de presentaciones. Beneficio:
   archivo más cercano a lo que el usuario necesita presentar.
3. Incorporar lectura concurrente y especialistas con fuentes independientes en
   un flujo de preparación de reunión o comparación. Beneficio: mejor información
   con menos espera y menos trabajo manual.
4. Permitir correcciones durante la ejecución. Beneficio: evitar repetir trabajo
   cuando el usuario cambia un requisito.
5. Evaluar descubrimiento de herramientas donde el catálogo cause errores reales.

Un primer piloto completo puede ser: «Compara estas propuestas de Drive y prepara
cinco diapositivas para dirección». Medir requisitos cumplidos, cifras respaldadas,
defectos visuales, tiempo hasta archivo utilizable y correcciones humanas. Comparar
contra el flujo actual con los mismos datos. Las métricas de tokens o cantidad de
agentes son secundarias al resultado del usuario.

No se prioriza otra ventana, más estados internos, sustituir el navegador existente
o portar Rust al producto. Esas inversiones requieren un problema concreto que las
justifique. El repositorio aporta mecanismos útiles; la selección de los casos de
uso y los verificadores del resultado sigue siendo trabajo de SofLIA.

## Verificación del informe

Se ejecutaron docs:check y docs:system:check: enlaces válidos en 334 Markdown
activos y catálogo documental coherente. No se cambió código de producto ni se
ejecutó de nuevo la suite del runtime para este cambio documental.
