# Diagnóstico de deuda técnica de Soflia Hub

Estado: diagnóstico puntual del 19 de octubre de 2026; no constituye certificación de seguridad ni de producción.

## Dictamen

**Índice estimado de deuda técnica: 50.38%, aproximadamente 50%.** Banda orientativa de sensibilidad: **40–60%**. Confianza media: buena evidencia del repositorio y sus verificadores; evidencia incompleta del despliegue, los proveedores reales y el producto instalado.

Este porcentaje expresa brechas técnicas ponderadas por importancia. No significa que la mitad del código sea incorrecto, que la mitad del presupuesto se haya perdido ni que reparar cueste la mitad de reconstruir. Un ratio financiero/SQALE necesitaría estimar horas de remediación y costo de construcción; esos datos no están disponibles. No es honesto presentar un porcentaje exacto de ese tipo.

El proyecto tiene una base sólida de tipado, modularidad por dominios, pruebas y especificaciones. La deuda se concentra en protección de credenciales, consistencia de autorización, publicación, dependencias y verificación integral. La cantidad de funcionalidades pendientes no se considera automáticamente deuda técnica.

## Alcance y fotografía

- Revisión inicial: `f0b18bca3948aa8157f8cc9e4a8d3fdaa2036da9`, con cambios locales existentes. Revisión al cierre: `e166d250629e503cf12f69449fb6d66e569134c8`. HEAD cambió durante el trabajo por actividad externa a este análisis; no se hicieron commits ni modificaciones al producto.
- Inventario: 2457 archivos TypeScript/TSX de producción en `electron/` y `src/`, con 177113 líneas físicas, incluidos comentarios y blancos. Se excluyeron pruebas y declaraciones `.d.ts` de esta métrica.
- Inventario documental del verificador: 600 archivos relacionados con pruebas, incluidos helpers/fixtures. Hay 435 entradas `.test.ts(x)` de main/renderer configuradas en Vitest; los 600 archivos no son 600 suites ejecutables.
- Se revisaron estándares, configuraciones, pipelines, contratos IPC, servicios críticos, SQL, agentes runtime, persistencia, pruebas y documentación. El inventario y el análisis sintáctico recorren el código de producción; la revisión manual fue una muestra dirigida por riesgo, no una lectura humana línea por línea de todo el sistema.
- No se consultaron datos de usuarios ni bases remotas, no se aplicó SQL, no se publicaron versiones y no se abrieron ni copiaron valores de `.env` o secretos. No se ejecutó el producto con cuentas reales.
- Artefacto de cálculo y resumen de comandos: [evidencia JSON](technical-debt-2026-10-19.json). Los logs extensos permanecen en el directorio temporal indicado en ese JSON.

## Método de puntuación

Cada área tiene cuatro criterios del mismo peso interno. Se asigna deuda `0` cuando el criterio revisado está satisfecho; `25` para brecha menor/localizada; `50` para implementación parcial o inconsistente; `75` para una brecha material; `100` para ausencia del control esencial. Los criterios son juicios técnicos respaldados por evidencia, no mediciones físicas de esfuerzo.

`Índice total = suma(peso del área × promedio de sus cuatro criterios) / 100`.

Los pesos suman 100. RLS se puntúa en datos; vulnerabilidades de paquetes en dependencias; la seguridad se concentra en secretos, IPC, guardas runtime y CSP. No se agregan puntos otra vez por cada mención de un mismo hallazgo. La banda 40–60 refleja sensibilidad al criterio del evaluador y a evidencia remota faltante; no es un intervalo estadístico.

| Área | Peso | Índice de deuda del área | Aporte al total |
|---|---:|---:|---:|
| Seguridad y privacidad | 20% | 50.00% | 10.00 puntos |
| Arquitectura y modularidad | 12% | 43.75% | 5.25 puntos |
| Calidad de código y tipado | 12% | 43.75% | 5.25 puntos |
| Pruebas y calidad funcional | 15% | 56.25% | 8.44 puntos |
| Datos e integridad | 10% | 43.75% | 4.38 puntos |
| Dependencias y cadena de suministro | 8% | 56.25% | 4.50 puntos |
| CI/CD, empaquetado y publicación | 8% | 68.75% | 5.50 puntos |
| Observabilidad y operación | 5% | 56.25% | 2.81 puntos |
| Rendimiento y escalabilidad | 4% | 50.00% | 2.00 puntos |
| Documentación y gobierno | 3% | 25.00% | 0.75 puntos |
| Accesibilidad y UX | 3% | 50.00% | 1.50 puntos |
| **Total** | **100%** | | **50.38%** |

Criterios exactos y valores usados:

| Área | Cuatro criterios y puntuaciones de deuda |
|---|---|
| Seguridad y privacidad | Credenciales de proveedor en cliente: 75; Autorización y schemas IPC heterogéneos: 50; Guardas de agentes y límites runtime: 25; CSP y defensa de fronteras: 50 |
| Arquitectura y modularidad | Separación de procesos y dominios: 25; Concentración del navegador: 75; Componentes/hooks extensos: 50; Fachadas y claridad de contratos: 25 |
| Calidad de código y tipado | TypeScript estricto y tipos de frontera: 25; Baseline lint y ejecutabilidad global: 75; Errores silenciosos y consistencia: 50; Disciplina local y supresiones: 25 |
| Pruebas y calidad funcional | Amplitud y casos negativos existentes: 25; Cobertura medida y umbrales: 75; E2E empaquetado y proveedores/Python en gate: 75; Reproducibilidad de la suite: 50 |
| Datos e integridad | Orden y evidencia de RLS/migraciones: 50; Atomicidad del borrado de proyectos: 50; Respaldo, retención y recuperación: 50; Constraints e idempotencia existentes: 25 |
| Dependencias y cadena de suministro | Avisos en dependencias de producción: 75; Avisos en herramientas de desarrollo: 75; Locks y revisión de ganchos: 25; Completitud del control automatizado incluido Python: 50 |
| CI/CD, empaquetado y publicación | Publicar condicionado al mismo commit verificado: 75; Paridad de build Linux: 75; Consistencia de Node y matriz de plataformas: 50; Firma/notarización e inmutabilidad del pipeline: 75 |
| Observabilidad y operación | Adopción de logs estructurados: 75; Correlación transversal: 50; Objetivos y alertas demostrados en repo: 50; Diagnóstico y estados operativos: 50 |
| Rendimiento y escalabilidad | Instrumentación y benchmark existentes: 25; Carga real de 800 usuarios verificada: 75; Consultas y paginación: 50; Presupuestos y regresión en CI: 50 |
| Documentación y gobierno | Estructura, enlaces y catálogo: 0; Actualidad semántica de runbooks: 50; Cierre de cambios OpenSpec: 25; Trazabilidad y límites declarados: 25 |
| Accesibilidad y UX | Semántica y teclado existentes: 25; Auditoría accesible automatizada: 75; Movimiento y equivalentes semánticos: 50; Regresión visual y flujos completos: 50 |

## Hallazgos prioritarios y medidas

### DT-01. Credenciales de proveedores incorporables al cliente — prioridad alta, confirmado en diseño de build

[src/config.ts](../../src/config.ts) lee `VITE_GEMINI_API_KEY` y `VITE_OPENAI_API_KEY`. El [workflow de release](../../.github/workflows/release.yml) las toma de GitHub Secrets y [check-release-env.mjs](../../scripts/quality/check-release-env.mjs) exige valores no vacíos. El [cliente OpenAI](../../src/services/openai-chat/client.ts) funciona en renderer con `dangerouslyAllowBrowser: true`.

Vite sustituye estas referencias por sus valores al compilar; guardar el valor original como GitHub Secret no lo mantiene secreto dentro del ejecutable distribuido. [Documentación oficial de Vite](https://vite.dev/guide/env-and-mode). También se incrustan valores para main mediante [env-defines.mts](../../config/vite/env-defines.mts); mover una clave compartida de renderer a main reduce exposición al renderer, pero no la hace confidencial frente al propietario del instalador.

Actor/precondición: alguien que tenga una distribución construida con claves compartidas válidas. Impacto: extracción y consumo de cuota fuera del flujo previsto. No se extrajo ninguna clave ni se comprobó abuso real. Las claves públicas anon/publishable de Supabase no se clasifican como secretos por el mero hecho de estar en el cliente.

Acción: usar credenciales por usuario y custodia nativa cuando corresponda, o un backend con autenticación, cuotas y secretos del servidor; retirar claves compartidas de los bundles. Después de confirmar qué artefactos se distribuyeron con ellas, planificar su rotación. Verificar negativamente que un bundle de prueba con canarios no contenga credenciales del servidor; nunca imprimir claves reales.

### DT-02. Autorización y confirmación heterogéneas en IPC — prioridad alta, confirmado en la ruta revisada

[calendar-handlers.ts](../../electron/calendar-handlers.ts) registra crear/actualizar/borrar eventos sin esquema de dominio, verificación de emisor o confirmación nativa en esos handlers. [event-updates.ts](../../electron/calendar/event-updates.ts) invoca directamente la API de Google después de obtener OAuth. La [API preload](../../electron/preload/calendar-api.ts) expone esas mutaciones. En cambio, [desktop-context-handlers.ts](../../electron/desktop-context-handlers.ts) sí comprueba autenticación y emisor.

La allowlist y el saneamiento genérico de [safe-ipc.ts](../../electron/preload/safe-ipc.ts) son controles útiles; no sustituyen autorización por operación ni validación del contenido de negocio. [Electron recomienda validar el emisor de mensajes IPC](https://www.electronjs.org/docs/latest/tutorial/security).

Actor/precondición: ejecución de JavaScript con acceso al puente autorizado del renderer y una cuenta de calendario conectada. Impacto posible: mutación externa sin una nueva decisión humana verificada por main. No se demostró una vía de entrada XSS ni se ejecutó ninguna mutación real. Una confirmación visual en otra capa no acredita, por sí sola, una barrera en main.

La CSP del renderer mantiene scripts propios, pero [security.ts](../../electron/preload/security.ts) admite conexiones a cualquier HTTP(S)/WS(S) y se inserta como meta al terminar DOMContentLoaded cuando el documento está cargando. Eso reduce defensa en profundidad; no prueba que exista XSS. La ventana principal sí habilita sandbox y context isolation, y deshabilita Node.

Los agentes runtime tienen guardas importantes: [execution.ts](../../electron/mcp-manager/execution.ts) valida contratos, agente, grupos, huella, HITL y timeout; [tool-guards.ts](../../electron/wa-executor/tool-guards.ts) aplica acceso y rutas protegidas de WhatsApp. No se declara inseguro todo el sistema por la ruta de calendario.

Acción: unificar validación del emisor/marco, autenticación y schemas cerrados; ligar las aprobaciones de mutaciones sensibles a actor, objeto y operación. Probar emisor ajeno, entrada malformada, cierre de sesión y aprobación ausente/obsoleta.

### DT-03. Estado de seguridad de datos no demostrable sólo con el repositorio — prioridad alta, riesgo de despliegue pendiente

[hub-service-state.sql](../../database/lia/migrations/hub-service-state.sql) concede `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`. Las migraciones históricas [meeting-ops-tables.sql](../../database/lia/migrations/meeting-ops-tables.sql) y [fix-meeting-ops-rls.sql](../../database/lia/migrations/fix-meeting-ops-rls.sql) también son permisivas.

Existe una corrección posterior: [project-hub-federation.sql](../../database/lia/migrations/project-hub-federation.sql) elimina las políticas permisivas de meetings y crea políticas por `owner_lia_user_id`. Main ya puede portar sesión mediante [hub-session.ts](../../electron/main/hub-session.ts). Por tanto, sería incorrecto concluir que todas las reuniones siguen abiertas. Tampoco hay evidencia aquí de que la corrección esté aplicada remotamente. La corrección de meetings no endurece por sí misma `hub_service_state`. Además, [hub-state-store.ts](../../electron/hub-state-store.ts) consulta y hace upsert sólo por `service_name`, sin owner/instalación; sigue usado por tareas programadas y automatización de workspace. Aun incorporando sesión al cliente, ese contrato no separa el estado de distintos usuarios y admite última escritura ganadora. Debe revisarse también la clave y los consumidores, no sólo la política SQL.

Coexisten scripts capaces de volver a crear políticas abiertas y documentación que todavía describe main sin sesión. No hay una secuencia global de migraciones fechada y demostrada que resuelva esta ambigüedad.

Acción: inventariar políticas efectivas y privilegios en cada entorno autorizado, establecer orden de migración, retirar los procedimientos permisivos del uso operativo y probar CRUD con dos usuarios distintos y un actor anónimo. Registrar aplicación, respaldo y rollback. Un archivo SQL no prueba despliegue ni una exposición en producción.

### DT-04. Integridad de borrado y errores parciales — prioridad alta, confirmado en código

[deleteProject](../../src/services/iris-data/projects.ts) hace tres borrados de dependencias y uno del proyecto como peticiones separadas. Ignora los errores devueltos por los tres primeros y decide éxito con el último. Una interrupción o rechazo intermedio puede dejar cambios parciales y una respuesta que no represente el conjunto de operaciones.

Acción: llevar la invariante a una transacción/RPC de base de datos con ownership verificado, o diseñar recuperación explícita si el contrato exige pasos separados. Comprobar error del primer, segundo y tercer paso, reintento y cancelación. No se borraron datos para demostrar este hallazgo.

### DT-05. Vulnerabilidades de dependencias fuera de la compuerta actual — prioridad alta

`npm audit --json` reportó **43 paquetes afectados: 18 high, 25 moderate, 0 critical**. Con `--omit=dev`, fueron **25: 10 high y 15 moderate**. El lock separado de Zoom reportó cero. Son resultados del registro npm consultado para esta fotografía, no 43 fallos independientes explotables ni un porcentaje de código vulnerable.

Entre las dependencias directas de producción afectadas aparecen `nodemailer`, `onnxruntime-node`, `pptxgenjs` y `sharp` en severidad alta, y `exceljs`, `mammoth` y `@nut-tree-fork/nut-js` en moderada. Parte de los avisos es transitiva o de instalación; exige análisis de alcanzabilidad.

[audit:supply-chain](../../scripts/quality/check-supply-chain.mjs) aprobó: comprueba una lista de versiones vetadas y ganchos de instalación revisados. No consulta todos los avisos CVE/GHSA de npm. Su éxito puede coexistir con un audit desfavorable. Python fija dependencias directas en sus requirements, pero no se verificaron aquí todas sus transitivas, hashes ni avisos.

Acción: clasificar exposición por ruta, actualizar por grupos pequeños y probar documentos/imágenes/correo/instalación; incorporar auditoría periódica con excepciones justificadas y vencimiento. No aplicar `npm audit fix --force` sin revisar compatibilidad.

### DT-06. Publicación desacoplada de la verificación y build Linux divergente — prioridad alta, confirmado en YAML

[ci.yml](../../.github/workflows/ci.yml) ejecuta `verify:pr` en Ubuntu/Node 24. [release.yml](../../.github/workflows/release.yml) publica por push a main o ejecución manual; sus jobs de build dependen de `check`, no de una ejecución de `verify:pr` dentro del workflow. No se inspeccionaron protecciones de rama externas, por lo que no se afirma que estén ausentes.

Release usa Node 20 y replica comandos. Windows/macOS llaman cadenas de build completas; Linux usa `npx tsc`, `npx vite build` y empaquetado directo. Omite las compilaciones separadas de presentaciones, audiovisual y Zoom presentes en [package.json](../../package.json). En un checkout limpio, esos bundles no quedan producidos por la cadena Linux revisada. Es un riesgo concreto de funcionalidades ausentes; no se construyó un instalador Linux para comprobarlo.

La configuración revisada no demuestra firma Windows ni notarización Apple. Las GitHub Actions están fijadas por tags, no SHA inmutable. No se auditó la política de protección de releases en GitHub.

Acción: hacer que publicar dependa de un gate aprobado para el mismo commit; reutilizar una sola cadena por plataforma; verificar presencia y arranque de los bundles en un paquete limpio; alinear Node y formalizar firma/notarización según distribución.

### DT-07. Verificación incompleta e inestable — prioridad alta

La primera ejecución JSON obtuvo 4435 casos aprobados, 4 fallidos y 5 omitidos. La ejecución de verify:pr obtuvo 4438 aprobados, 1 fallido y 5 omitidos, además de 7 errores no gestionados de teardown; falló el informe visual de PresentationWorkspacePanel. Esas primeras ejecuciones compartieron recursos con otros verificadores. La repetición con concurrencia limitada a dos workers obtuvo **4438 aprobados, 1 fallidos y 5 omitidos**, con success=false. El caso fallido fue la creación y lectura conjunta de Word, PowerPoint y Excel en `electron/__tests__/background-teams.test.ts`; el reporte registra 15.907 ms de duración. Su JSON sólo conserva STACK_TRACE_ERROR: no permite concluir aquí la causa exacta. No hubo menciones de EnvironmentTeardownError en el log de esta repetición. Resultados distintos entre ejecuciones justifican investigar inestabilidad; no se atribuye automáticamente cada fallo a un defecto funcional ni a falta de recursos.

[vitest.config.ts](../../vitest.config.ts) separa main y renderer; Electron está sustituido por mocks y renderer usa jsdom. Hay pruebas valiosas de políticas, schemas, archivos y estados negativos. También hay casos de contrato que inspeccionan código fuente y aserciones débiles: por ejemplo RS-007 en [iris-data.test.ts](../../src/__tests__/services/iris-data.test.ts) acepta cualquier array sin verificar que el filtro por equipo se haya aplicado.

El comando de cobertura existe, pero no hay thresholds ni un reporte actual medido en esta auditoría. El porcentaje de tests aprobados no se convierte en cobertura de código. Los smoke nativos son útiles y opt-in, pero no forman parte del gate PR. No hay una suite empaquetada completa Windows/macOS ni contratos reales de todos los proveedores demostrados en CI. Las suites Python existen, pero no están ejecutadas por `run-gate.mjs`; el runtime local Python no estaba disponible para repetirlas aquí.

Acción: estabilizar las pruebas con fallos y el drenaje de promesas; medir cobertura por rutas críticas y adoptar umbrales graduales; agregar smoke de instalación/autenticación/lectura/acción aprobada, y pruebas Python al gate correspondiente. No se requiere convertir todo a E2E ni sustituir las pruebas existentes.

### DT-08. Concentración de complejidad y disciplina de código — prioridad media

El inventario encontró 23 archivos de producción por encima de 500 líneas y 3 por encima de 1.000. [integrated-browser/service.ts](../../electron/integrated-browser/service.ts) tiene 5727 líneas y concentra gestión de pestañas, permisos, perfiles, control del agente y diversas operaciones. El AST detectó 107 funciones/métodos de más de 100 líneas; algunas contienen JSX o lógica gráfica y su longitud no demuestra por sí sola mala cohesión.

TypeScript está en modo estricto. Aun así, hay 1495 nodos de tipo `any` explícito en producción y 149 bloques catch sin sentencias; algunos son fallback deliberado. Son señales para priorizar revisión, no 149 bugs demostrados. La separación main/preload/renderer y los módulos de dominio reducen la deuda general de arquitectura.

El comando global original falló por descubrimiento de configuraciones en worktrees anidados: no se cuentan sus 19.979 mensajes como deuda del código. Una ejecución diagnóstica de ESLint limitada a archivos de src/electron y con tsconfigRootDir explícito encontró **1674 errores y 28 avisos en producción**, repartidos en 566 archivos. La mayoría son no-explicit-any (1493); hay también reglas de hooks, variables, manejo de errores y otras. Incluyendo pruebas y declaraciones, fueron 2102 errores y 28 avisos. La configuración diagnóstica no se guardó en el proyecto. El lint incremental del gate aprobó porque contrasta con la línea base histórica; no certifica un árbol sin deuda.

Acción: dividir el coordinador del navegador por ciclos de vida y contratos independientes; fortalecer tipos en fronteras antes de refactorizar por estética; sustituir capturas silenciosas cuando ocultan pérdida de datos o errores de proveedor. Priorizar archivos con cambios frecuentes y riesgo, no dividir archivos sólo por una cifra.

### DT-09. Observabilidad, recuperación y retención — prioridad media/alta

Existe un [logger estructurado con redacción y correlación](../../electron/utils/logger-options.ts), pero el barrido estático encontró 1053 llamadas `console.*` en 435 archivos de producción. Sólo 2 archivos contienen una llamada literal a `createLogger(`, incluido el propio módulo; esta señal no mide todo logger posible ni acredita fuga de datos. La adopción de la estrategia estructurada es limitada frente al logging disperso.

[release-and-recovery.md](../operations/release-and-recovery.md) documenta respaldos parciales y reconoce ausencia de RPO/RTO cuantitativo. Memoria/knowledge no tienen un respaldo automático integral demostrado; algunas copias dependen del mismo usuario y proveedor de cifrado del SO. La [arquitectura de datos](../data/data-architecture.md) también reconoce retenciones incompletas y persistencia local heterogénea.

Acción: estandarizar eventos de operación/duración/resultado y propagación de traza, definir retención por tipo de dato y probar restauraciones de muestra. Fijar RPO/RTO con el negocio antes de prometerlos. No se inspeccionaron alertas ni respaldos contratados fuera del repositorio.

### DT-10. Rendimiento y escala parcialmente medidos — prioridad media

Hay benchmark sintético y medidas de recursos/pestañas frías en [scripts/performance](../../scripts/performance), además de parámetros y timeouts explícitos. Esto es una fortaleza. No se repitió el benchmark bajo la carga concurrente de esta auditoría, porque esa medición no representaría el uso normal.

El objetivo de 800 usuarios está definido en [load-and-scalability.md](../architecture/load-and-scalability.md), pero [sus tareas](../../openspec/changes/scale-hub-data-800-users/tasks.md) dejan pendientes carga, EXPLAIN y verificaciones remotas. No es capacidad demostrada. Subsisten lecturas `select('*')` y listados sin paginación explícita, como `getProjects`; su costo real exige datos y planes.

Acción: ejecutar el escenario autorizado en staging, capturar p95/p99 y errores, revisar consultas calientes y establecer presupuestos de recursos/latencia como regresiones. No inferir capacidad o ahorro de CPU a partir de arquitectura.

### DT-11. Documentación y gobierno: buena estructura, desfase semántico — prioridad media

Pasaron harness, enlaces, catálogo documental y OpenSpec estricto. El verificador reconoce 28 documentos de sistema, 150 IDs y 494 canales IPC declarados; eso comprueba trazabilidad estructural, no la corrección funcional de los 494 contratos.

Persisten contradicciones: [RNF-013](../product/non-functional-requirements.md) y [development-and-devops.md](../operations/development-and-devops.md) exigen reconstruir `better-sqlite3` y ejecutar `rebuild:native:electron`, mientras el producto usa [node:sqlite](../../electron/sqlite/database.ts) y ese script no existe en package.json. Las guías de seguridad/datos siguen describiendo main sin sesión para meetings pese a la implementación de sesión y la migración posterior.

Hay 70 cambios OpenSpec no archivados, 45 sin casillas abiertas y 125 casillas pendientes. Son señales de higiene del ciclo de cambio; no se suman como deuda funcional ni prueban que el trabajo pendiente sea necesario para el release. Falta distinguir más consistentemente diseño terminado, implementación y validación externa.

Acción: corregir primero runbooks que el operador puede ejecutar erróneamente; conciliar los estados reales y archivar cambios terminados después de su revisión. Ampliar validación semántica de scripts citados, no sólo de enlaces.

### DT-12. Accesibilidad y UX: controles presentes, verificación pendiente — prioridad media

[accessibility.md](../ux/accessibility.md) registra roles, foco, teclado, temas y confirmaciones implementados. También reconoce falta de objetivo WCAG formal, axe en CI, auditoría de lector de pantalla, regresión visual y aplicación global de movimiento reducido. Hay componentes grandes y canvas/orbe sin equivalencia semántica completa demostrada.

Acción: fijar el objetivo de accesibilidad del producto y cubrir teclado/foco/200% zoom/movimiento reducido en flujos críticos; añadir axe y unas pocas capturas visuales representativas. No se afirma incumplimiento legal ni certificación: no hubo auditoría normativa ni uso manual exhaustivo.

## Evidencia ejecutada

| Comando o análisis | Resultado observado |
|---|---|
| npm run typecheck | Aprobó en el gate y volvió a aprobar en una ejecución final separada. |
| npm run verify:pr | Falló: 1 test fallido, 4438 aprobados, 5 omitidos; 7 errores de teardown. No se declara gate verde. |
| npm run test -- --reporter=json ... | 4435 aprobados, 4 fallidos, 5 omitidos; ejecución inicial concurrente con otros verificadores. |
| npm run test -- --maxWorkers=2 --reporter=json ... | 4438 aprobados, 1 fallidos, 5 omitidos; success=false. |
| npm run lint -- --format json ... | Falló al descubrir múltiples tsconfigRootDir y recorrer worktrees anidados. Sus 19979 errores de parser NO se cuentan como defectos del producto. |
| ESLint API sobre src/electron, tsconfigRootDir=raíz | 1674 errores y 28 avisos de producción; 2102 errores y 28 avisos incluyendo pruebas/declaraciones. |
| npm run lint:changed (dentro del gate) | Aprobó 38 archivos en aquella fotografía. Es comparación contra baseline, no ausencia de deuda global. |
| adapters:check / harness:validate | Aprobaron: 30 adaptadores; 25 rutas y 10 skills canónicas. |
| docs:system:check / docs:check | Aprobaron antes de añadir este informe: 28 documentos, 150 IDs, 494 canales y 600 archivos relacionados con pruebas; 561 Markdown activos con enlaces válidos. |
| skills:seed:check / openspec:validate | Aprobaron; 70 cambios OpenSpec válidos. |
| npm run audit:supply-chain | Aprobó lista de versiones vetadas y ganchos; no equivale a npm audit. |
| npm audit --json | 43 paquetes afectados: 18 high, 25 moderate. |
| npm audit --omit=dev --json | 25 paquetes afectados: 10 high, 15 moderate. |
| npm audit --prefix packages/zoom-runtime --json | 0 avisos reportados. |
| Suite Python | No ejecutada: runtime Python local no disponible. No se instaló software. |

No se ejecutaron `verify:release`, empaquetados, publicación, pentest, prueba de carga remota ni recuperación de datos de usuarios. El análisis no modifica aplicación, SQL, configuración local o secretos. No se corrigieron los defectos porque el encargo era un diagnóstico.

Después de generar este informe, volvieron a aprobar `docs:check` (562 archivos Markdown activos) y `docs:system:check` (28 documentos de sistema, 150 IDs, 494 canales y 600 archivos relacionados con pruebas). La ejecución final separada de `typecheck` también aprobó. Esto valida el informe y los tipos; no convierte en aprobada la compuerta que falló en pruebas.

## Orden de reducción recomendado

1. **Primero:** retirar credenciales compartidas del cliente; verificar políticas efectivas y su orden de migración; cerrar las mutaciones IPC sensibles; resolver el borrado parcial de proyectos.
2. **En el siguiente bloque:** hacer reproducible el gate, resolver avisos de dependencias alcanzables y condicionar la publicación al mismo commit verificado; unificar build Linux.
3. **Después:** introducir cobertura por riesgo, smoke del producto empaquetado y Python en CI; probar restauración/retención; refactorizar el coordinador del navegador con contratos conservados.
4. **De forma continua:** actualizar runbooks, reducir `any` en fronteras, ampliar logs estructurados y automatizar accesibilidad/performance.

No se asignan semanas/persona ni ahorro porcentual a estas acciones sin estimación por responsable. Para repetir el índice hay que usar los mismos criterios, registrar cada evidencia nueva y recalcular; un gate verde no elimina automáticamente la deuda arquitectónica u operativa.

## Límites de confianza

La fotografía puede cambiar con otros commits, advisories npm o configuración del proveedor. El estado de RLS, permisos GitHub, firma efectiva, cuotas, backups, alertas y disponibilidad fuera del repositorio queda sin verificar. Se diferencian defectos comprobados, riesgos condicionados y ausencia de evidencia. El índice permite ordenar la mejora, pero no sustituye una auditoría de producción, un modelo de amenazas completo ni un cálculo de costo de remediación.
