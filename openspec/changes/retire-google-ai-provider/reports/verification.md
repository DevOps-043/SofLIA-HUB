# Verificación de retirada del proveedor de IA

Fecha 2026-11-07. Retirada integral en curso. Esta evidencia cubre catálogo,
preferencias, custodia pública y proveedores de equipos. Gate y build locales aprobados.

## Cambios ejecutados

El catálogo ofrece SofLIA y Max con OpenAI. Las preferencias de modelos retirados
se convierten al predeterminado y conservan razonamiento compatible sin pisar una
preferencia OpenAI ya guardada. La migración opera dentro del ámbito activo.
Renderer y preload excluyen VITE_GEMINI_API_KEY. Los componentes de ajustes dejaron
de pasarla a WhatsApp. Main conserva temporalmente la variable para servicios
pendientes de migración.

Equipos en segundo plano usan OpenAI. Las validaciones de entrada y persistencia
reconcilian modelos retirados, evitando perder trabajos. Se conserva el control de
propietario y organización antes y después de resolver cliente. El proveedor
Gemini fue retirado de este módulo.

El arnés de reuniones usa OpenAI o Codex. La ruta OpenAI obtiene el cliente nativo,
usa Responses y conserva tools, call_id, historial de salida y tokens. El panel
ofrece los proveedores actuales. El historial cifrado admite el identificador
anterior al leerlo y lo convierte a OpenAI. La recuperación del arnés retira
las aprobaciones anteriores mediante su ciclo de vida existente. Se retiró el
fichero del proveedor anterior con respaldo previo.

## Pruebas focalizadas

82 pruebas del catálogo, preferencias, equipos y entorno pasaron. Otras 24 del
arnés y panel pasaron. Las pruebas adicionales usan el SDK OpenAI con transporte
ficticio para verificar llamada, resultado de herramienta y uso de tokens, además
de cancelación y argumentos malformados. El primer fixture omitía object=response,
requerido por el helper de texto del SDK. Se corrigió para representar su contrato
real. Los casos del selector compacto se actualizaron al catálogo retirado.

## Revisión propia y límites

Se revisó continuidad de trabajos e historiales, separación de identidades,
cancelación antes de transporte y herramientas, exclusión de claves del build,
preferencias por usuario y conservación de aprobación humana. Las pruebas usan
cuentas, claves y transportes ficticios. La revisión independiente sigue pendiente.

La retirada integral sigue abierta en chat y utilidades, Flow, imagen, audio,
embeddings, extracción de reuniones, WhatsApp, control visual y auxiliares. Las
dependencias Google continúan instaladas para esas rutas. Es necesario retirar
sus endpoints, canales y configuración al completar cada migración.

Backups, comandos y JSON bajo `%TEMP%/soflia-retire-google-ai-2026-11-07/`.

## Resultado local de esta fase

`npm run verify:pr` terminó con código 0. Pasaron 7083 pruebas y se omitieron 5,
en 593 archivos aprobados y dos omitidos. El lint incremental revisó 771 archivos
sin deuda nueva. Cobertura de 2637 fuentes productivas con líneas 60.76%,
sentencias 59.23%, funciones 55.67% y ramas 52.59%.

`npm run app:smoke:build` terminó con código 0 y conservó avisos de tamaño de
fragmentos. La huella productiva coincide antes/después y con el build.
SHA-256 `052347c3bba43b1cf366d2eb4d653c0e739a3364fecb01ea1d9c0d37b01b63f7`.

La tarea integral continúa abierta. El inventario remaining-provider-files.json
registra las fuentes que todavía importan SDK o acceden al endpoint Google.
La revisión independiente y la validación con cuentas y proveedores reales siguen
pendientes. La evidencia local no acredita la eliminación total de Gemini.

Contrato Responses consultado en documentación oficial de OpenAI para enlazar
resultados mediante call_id y conservar los items de salida del modelo.
[Function calling](https://developers.openai.com/api/docs/guides/function-calling)


## Continuidad: OpenAI para medios, utilidades y extracción

El usuario confirmó distribución sólo de escritorio. Se migraron imágenes,
Flow (análisis, fallback y dictado), especialistas, títulos, redacción,
optimización, clasificación/extracción de reuniones y tareas JSON del workspace.
Se retiró Gemini como destino del optimizador y se eliminaron SDK/fallbacks de
esas capacidades. Los canales son ai:image-generation y ai:flow-inference, con
las cuatro capas y límites anteriores; no se agregaron permisos de herramientas.

El cliente autenticado compartido vive en electron/ai-provider/session-client.ts.
Fija endpoint oficial, no hereda organización/proyecto y rechaza RPC malformado.
No conserva clientes por usuario ni permite usar uno después de revocar sesión.
Las tareas JSON validan el schema; las reuniones conservan clasificación previa,
normalización, evidencia y revisión humana. No reciben la clave Google del
inicializador de WhatsApp. Los setters y helpers inalcanzables se retiraron.

Las pruebas dirigidas de medios pasaron 45 casos. Las de utilidades y privacidad,
34; reuniones/cliente/proveedor, 16; tareas JSON y consumidores, 16. Estos grupos
se solapan: no deben sumarse como un total de casos únicos. Usan transporte y
credenciales ficticios; las pruebas de proveedor ejercitan el SDK instalado.

La primera compuerta de esta fase, antes de los últimos servicios y parches de
dependencias, pasó 7088 casos y omitió cinco; cubrió 2635 fuentes. Ese recibo
histórico no sustituye al resultado final siguiente.

### Revisión propia y riesgos restantes

Se buscaron fugas por credenciales/entorno, uso de puentes ausentes, estados
revocados, admisión tardía, slots físicos, respuestas malformadas, herramientas
inesperadas, schemas inválidos y errores privados. No se encontraron nuevos
permisos ni se bajaron umbrales de verificación. La revisión independiente sigue
pendiente. AAC y otros transportes heredados no se dan por migrados por haber
migrado el dictado de Flow.

El inventario operativo directo actual conserva 56 archivos. La retirada total
continúa abierta en chat heredado, grounding, medios, audio de WhatsApp, memoria,
embeddings, control visual y auxiliares, además de SDK/configuración y sus
consumidores indirectos. Los modelos OpenAI se comprobaron con SDK y fixtures;
no se acredita disponibilidad de cuentas ni ejecución real del proveedor.

La simulación contra los commits indicados encontró 72 y 82 rutas con conflicto;
los commits tienen 36 conflictos entre sí. No se hizo merge. La simulación por
ruta no resuelve renombrados ni comprueba la lógica combinada. Ver
[informe de integración](integration-analysis.json).

[Reevaluación de los 44 criterios](../../../../docs/reports/technical-debt-reassessment-2026-11-07.md):
índice experto estimado 38,875%, sin afirmar retirada completa o release estable.

Backups y recibos: %TEMP%/soflia-openai-media-2026-11-07/,
%TEMP%/soflia-openai-utilities-2026-11-07/,
%TEMP%/soflia-openai-meeting-extraction-2026-11-07/ y
%TEMP%/soflia-openai-structured-tasks-2026-11-07/.

Contrato de Audio e imágenes consultado en documentación oficial de OpenAI:
[Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text),
[modelo de imágenes](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare).


### Resultado final local de esta continuidad

Compuerta de PR: código 0, 7096 casos aprobados y cinco omitidos, 596 archivos
aprobados y dos omitidos. Pasaron 64 contratos del tooling y 33 de Python.
Lint incremental: 794 archivos sin deuda nueva. Cobertura de 2633 fuentes:
líneas 60,93%, sentencias 59,37%, funciones 55,86% y ramas 52,70%.
Build aislado: código 0, conservando avisos de tamaño de fragmentos.

La huella productiva permanece idéntica antes/después de la verificación y del
build: cab2e3cb755a04df62493bbc00087ec62eaf807ab1ff45f729daeff02701b2d3.
Docs/enlaces, inventario y OpenSpec se comprobaron otra vez tras los reportes.
El [recibo](latest-verification.json) conserva hashes y comandos. No se modificó
el índice ni se aplicó merge. La retirada integral y la revisión independiente
continúan abiertas; no se acredita aplicación instalada o proveedores reales.

### Continuidad de control visual, audio y memoria

El controlador de Desktop, navegador y UIA usa Responses y conserva sus drivers.
La salida del modelo se valida contra un catálogo por superficie y se correlaciona
por identificador de llamada. Se conserva la revisión de acciones sensibles y se
envía una sola captura reciente. La configuración anterior del motor se migra a
OpenAI. Orbe usa el modelo OpenAI de SofLIA.

Se migraron transcripción de WhatsApp y Telegram, imágenes de presentaciones,
búsqueda web, resúmenes de actividad y portapapeles, categorización de archivos y
embeddings. El chat OpenAI admite imágenes, cuadros y transcripciones de audio
compatible. Los medios sin preparación se marcan como omitidos. El índice
semántico del navegador conserva el consentimiento y exige reconstrucción.
Los vectores conversacionales anteriores permanecen en disco sin participar en
comparaciones con OpenAI.

El inventario directo pasó de 56 a 12 fuentes. Quedan chat y grounding heredados,
transporte de medios grandes y validación de claves, además de sus dependencias
y configuración. Está pendiente la conversión de AAC crudo y la reindexación
conversacional. La revisión independiente y la comprobación del producto
integrado siguen abiertas.

Las suites focalizadas verificaron cancelación del controlador visual, esquema de
acciones, reproducción de contexto de equipo, transcripción, límites de audio,
compatibilidad de configuración, índice anterior del navegador y puente nativo
de chat con transportes simulados. Los resultados del lote se guardan bajo
%TEMP%/soflia-retire-remaining-2026-11-07/. El recibo de la fase anterior no se
atribuye a este estado del worktree.

La comprobación incremental alcanzó typecheck y lint de cambios aprobados.
La suite con cobertura y el build de esta revisión se ejecutaron por separado.
Los recibos gate-final.log y build-final.log deben comprobarse antes de
atribuirles un resultado final. Pasaron las suites dirigidas de control visual
y memoria, chat nativo, y configuración y Orbe. El caso de reconstrucción
verifica que un vector de otro modelo no se compare con OpenAI.

### Retiro del SDK anterior y del validador

El inventario directo quedó en 11 fuentes. Se retiraron el SDK anterior
`@google/generative-ai`, su entrada en el lockfile y el validador de credenciales
Gemini sin consumidores. OpenAI usa el catálogo de herramientas y los tiempos
límite compartidos sin importar el bucle conversacional de Gemini.

Pasaron las dos ejecuciones dirigidas de 56 y 28 casos, con suites compartidas
entre ambas. La conversación nativa, el grounding y el transporte de medios
grandes conservan dependencias del proveedor anterior.
