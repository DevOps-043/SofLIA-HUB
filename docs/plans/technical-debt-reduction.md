# Reducción progresiva de deuda técnica

Estado: en ejecución. Actualizado: 2026-10-30.

Base: [diagnóstico](../reports/technical-debt-2026-10-19.md). Es un índice experto,
no una medida de costo. Se preserva la fotografía histórica; no se reduce su
porcentaje sólo por cerrar tareas. El umbral solicitado se interpreta como deuda
de hasta 5% exenta: ninguna área evaluada cumple ese umbral.

[Última reevaluación global publicada, después de la unidad 37](../reports/technical-debt-reassessment-2026-10-25.md):
índice ponderado 40.88% (aproximadamente 41%), frente a 43.25% antes del lote
y 50.38% inicial. Se conservan los 44 criterios y pesos: el lote transversal
reduce 2.38 puntos por cobertura/control de pruebas e inmutabilidad CI.
Reducción acumulada: 9.50 puntos. Es estimación de brechas, no costo SQALE.

[Progreso acumulado al 25 de octubre](../reports/technical-debt-progress-2026-10-25.md):
unidades intervenidas, auditoría npm repetida y pendientes por área, sin confundir
avance local con un porcentaje global recalculado.

## Unidades

El lote 48 [secure-communication-hub-ipc](../../openspec/changes/secure-communication-hub-ipc/proposal.md)
cierra la autoridad de diez canales de comunicación, valida inputs y exige
aprobación nativa para cambios críticos. Acota historial/identidades, revalida
SOFIA tras confirmar y evita heredar leases en transportes permanentes.
[Evidencia](../../openspec/changes/secure-communication-hub-ipc/reports/verification.md):
6839 pruebas aprobadas, cinco omitidas, 93 nuevas; compuerta y build aislado
aprobados. 29 errores/any productivos eliminados, sin incidencias nuevas;
cobertura de líneas 59.43%. La revisión corrigió coerción de enums que permitía
eludir capacidades de grupos y la misma clase de fallo en OpenAI, reutilizando
el validador JSON. Ownership de conexiones, otras APIs directas y revisión
independiente siguen pendientes. No se infiere un nuevo porcentaje global.

El lote 47 [move-openai-inference-to-main](../../openspec/changes/move-openai-inference-to-main/proposal.md)
migra Responses de chat y análisis en equipo a main con cuatro capas, scope
revocable y streaming bajo demanda. Los consumidores migrados dejan de construir
el SDK HTTP o consultar la clave; Vite excluye OpenAI de defines públicos/preload.
Se conservan herramientas y modelos. El recibo Auth/Lia
evita seleccionar la cuenta previa durante una transición; los errores del
proveedor cruzan como categorías finitas.
[Evidencia](../../openspec/changes/move-openai-inference-to-main/reports/verification.md):
6746 pruebas aprobadas, cinco omitidas, 74 nuevas y 194 dirigidas. Compuerta y
build centinela aprobados; un error/any productivo menos, sin incidencias nuevas.
Cobertura de líneas 59.14%; 31 fuentes cambiadas conservan las cuatro capas.
Revisión independiente pendiente. Gemini/medios/OAuth, acceso servidor y secretos
dentro del instalador conservan trabajo propio; no se infiere nuevo porcentaje global.

El lote 46 [guard-backend-task-cancellation](../../openspec/changes/guard-backend-task-cancellation/proposal.md)
protege etapas y acciones compuestas web/UIA contra decisiones revocadas, conserva
limpieza ante fallos de inicio/finalización y tipa funciones del flujo intervenido.
[Evidencia](../../openspec/changes/guard-backend-task-cancellation/reports/verification.md):
6672 pruebas aprobadas, cinco omitidas; 44 nuevas, compuerta y build
aislado aprobados. 46 errores/any de producción menos, sin incidencias nuevas.
Revisión independiente pendiente.
No acredita reversión de I/O, aislamiento global de perfiles ni nuevo índice global.

El lote 45 [bind-desktop-task-publications](../../openspec/changes/bind-desktop-task-publications/proposal.md)
liga resultados/eventos de tareas a identidad originaria, conserva contexto en
las tres colas y evita aprendizaje desde payloads sin procedencia o revocados.
No declara aislados todos los historiales/cachés/perfiles.
[Evidencia](../../openspec/changes/bind-desktop-task-publications/reports/verification.md):
6,628 pruebas aprobadas y cinco omitidas; compuerta y build aislado aprobados.
Cinco errores/any de producción menos, sin incidencias nuevas ni umbrales
relajados. Revisión independiente pendiente, sin nuevo porcentaje global inferido.

El lote 44 [secure-desktop-agent-ipc](../../openspec/changes/secure-desktop-agent-ipc/proposal.md)
protege los 23 canales Desktop Agent, mantiene controles independientes,
propaga señales a tareas y corrige observación revocada. Teclado cerrado y
configuración validada/atómica sin éxito previo al guardado.
[Evidencia](../../openspec/changes/secure-desktop-agent-ipc/reports/verification.md):
6602 pruebas aprobadas, incluidas 128 nuevas; doce errores de lint eliminados,
cuatro métricas de cobertura mejoradas y build aislado correcto. Revisión
independiente pendiente; no se infiere porcentaje global ni ownership de estado runtime.

El lote 43 [secure-computer-gui-backends](../../openspec/changes/secure-computer-gui-backends/proposal.md)
retira shell del adaptador GUI heredado, separa programas/datos, acota hijos y
revalida sesión durante OCR. Corrige contrato Tesseract 7 y cierre del worker
admitido. No abre el canal GUI en preload ni reemplaza Desktop Agent.
[Evidencia](../../openspec/changes/secure-computer-gui-backends/reports/verification.md):
6474 pruebas aprobadas, incluidas 69 nuevas; cuatro errores de lint eliminados,
cuatro métricas de cobertura mejoradas y build aislado correcto. Verificación
nativa e independiente pendientes, sin porcentaje global inferido de este lote.

El lote 42 [secure-computer-use-ipc](../../openspec/changes/secure-computer-use-ipc/proposal.md)
protege los 33 canales de herramientas Computer Use y confirmación informativa,
valida entradas y liga aprobación nativa a argumentos. Conserva cuatro capas y
acota trabajos físicos.
[Evidencia](../../openspec/changes/secure-computer-use-ipc/reports/verification.md):
6405 pruebas aprobadas, incluidas 77 nuevas; once errores de lint eliminados,
cuatro métricas de cobertura mejoradas y build aislado correcto. Revisión
independiente pendiente. No recalcula el índice global ni acredita otras rutas
runtime/GUI/desktop-agent.

El lote 41 [secure-grounded-generation](../../openspec/changes/secure-grounded-generation/proposal.md)
protege generación/cancelación con fuentes, conserva herramientas utilizadas,
acota HTTP y elimina fallback de autoridad en Electron. Integra DTO puros y
respuestas unknown comprobadas.
[Evidencia](../../openspec/changes/secure-grounded-generation/reports/verification.md):
6328 pruebas aprobadas, incluidas 49 nuevas; 38 errores de lint eliminados,
cuatro métricas de cobertura mejoradas y build aislado correcto. Sin relajar
reglas ni cambiar dependencias. Custodia general de claves y revisión
independiente pendientes; no se infiere un nuevo índice global de este lote.

El lote 40 [secure-remote-node-credentials](../../openspec/changes/secure-remote-node-credentials/proposal.md)
retira persistencia plana/global de nodos, cifra por propietario, preserva el
legado y liga servicio/host/caché a sesión. Publica mutaciones sólo tras guardar.
[Evidencia](../../openspec/changes/secure-remote-node-credentials/reports/verification.md):
6279 pruebas aprobadas, incluidas 52 nuevas; cuatro métricas de cobertura
mejoradas, build aislado y hashes estables. Caché, borrador y captura del panel
se retiran por identidad; revisión independiente y otras APIs siguen pendientes.

El lote 39 [secure-remote-node-ipc](../../openspec/changes/secure-remote-node-ipc/proposal.md)
cierra los 13 canales de nodos con fuente/sesión, schemas y confirmación nativa.
Vincula revisión a configuración, acota/cancela HTTP y corrige el binding de
interfaz y las reconciliaciones concurrentes del host.
[Validación](../../openspec/changes/secure-remote-node-ipc/reports/verification.md):
6227 pruebas aprobadas (140 nuevas), cuatro métricas de cobertura mejoradas,
build aislado y hashes estables. Lint src/electron: 1888 → 1878 errores, sin
incidencias nuevas por archivo/regla/severidad. No atribuirle cifrado/ownership ni
autorización de todas las APIs o rutas runtime; revisión independiente pendiente.

El lote 38
[type-automation-bridge-contracts](../../openspec/changes/type-automation-bridge-contracts/proposal.md)
unifica las tres APIs de automatización entre main/preload/renderer, valida
respuestas remotas y retira tokens de resultados conversacionales. Eliminó
121 errores (2009 → 1888) y redujo any en producción 8.55% (1416 → 1295).
[Evidencia](../../openspec/changes/type-automation-bridge-contracts/reports/verification.md):
6087 pruebas aprobadas, cobertura superior en las cuatro métricas, build aislado
y hashes estables. No recalcula a la baja el índice global por mejoras dentro
del mismo escalón de rúbrica; siguen pendientes autorización/HITL nativos,
custodia de nodos y revisión independiente. Se conserva la modularidad integrada.

El usuario pidió acelerar el impacto global. El lote
[gate-global-quality-and-workflow-integrity](../../openspec/changes/gate-global-quality-and-workflow-integrity/proposal.md)
prioriza cobertura obligatoria de toda producción e integridad de dependencias
CI, con una sola suite final con cobertura y build aislado. Evita supresiones
y reemplazos automáticos de tipos sin contrato. [Medición y límites](../../openspec/changes/gate-global-quality-and-workflow-integrity/reports/verification.md).

[reduce-technical-debt-foundation](../../openspec/changes/reduce-technical-debt-foundation/proposal.md)
repara tooling/publicación y la frontera integrada de calendario, con contratos,
pruebas y evidencia. Implementada y verificada localmente; conserva pendiente
la revisión independiente. No sustituye main/preload/renderer ni despliega cambios.

[reduce-vulnerable-dependencies](../../openspec/changes/reduce-vulnerable-dependencies/proposal.md)
actualiza parches de Sharp, Vite, Vitest y transitivas compatibles. Su
[evidencia](../../openspec/changes/reduce-vulnerable-dependencies/reports/verification.md)
compara auditorías del mismo día y comprueba instalación física, consumidores y
build aislado. Implementada y verificada localmente: 45 → 28 paquetes afectados,
20 → 9 con severidad alta, sin nuevos avisos. El gate aprueba 4492 pruebas y el
smoke compila los seis artefactos principales y auxiliares. Los avisos residuales
se mantienen visibles; estas cifras no recalculan el índice global de deuda.

[secure-calendar-credentials](../../openspec/changes/secure-calendar-credentials/proposal.md)
implementa custodia cifrada por propietario, migración recuperable y ciclo de vida
de sesión/OAuth/polling. [Evidencia](../../openspec/changes/secure-calendar-credentials/reports/verification.md):
4529 pruebas aprobadas, 5 omitidas y smoke DPAPI real en tres procesos aislados.
Se conservan perfiles y secretos reales sin inspeccionarlos; revisión independiente pendiente.

[isolate-browser-session-checkpoint](../../openspec/changes/isolate-browser-session-checkpoint/proposal.md)
concentra siete campos de autosave/cierre en un módulo del navegador con contratos
propios. El coordinador conserva vistas, perfiles y selección de datos;
API/IPC/formato permanecen iguales. Añade invalidación tras la última espera
de limpieza. [Evidencia](../../openspec/changes/isolate-browser-session-checkpoint/reports/verification.md)
de pruebas dirigidas y lifecycle nativo con checkpoint/store reales temporales;
compuerta completa aprobada: 4545 pruebas y 5 omitidas. Implementada y verificada
localmente; revisión independiente pendiente. El reporte conserva límites y
reversión, sin recalcular el índice global por trasladar líneas de código.

[guard-gmail-delivery](../../openspec/changes/guard-gmail-delivery/proposal.md)
elimina el envío con adjuntos omitidos y concentra preparación/confirmación y
resultado incierto del correo. Mantiene capas main/preload/wrapper y comparte
guardas con calendario. Nodemailer 10.2.1 retira los ocho avisos que afectaban a
la versión instalada: auditoría de 28 a 27 paquetes afectados, 9 a 8 high, sin
paquetes afectados nuevos. Otros canales se abordan en las unidades posteriores;
la revisión independiente queda pendiente. [Evidencia final](../../openspec/changes/guard-gmail-delivery/reports/verification.md):
4609 pruebas aprobadas, 5 omitidas y build aislado de los seis artefactos. No se
recalcula el porcentaje global a partir de estos resultados.

[secure-gmail-organization-plans](../../openspec/changes/secure-gmail-organization-plans/proposal.md)
protege preview/apply/undo con custodia cifrada por usuario/cuenta, validación de
ID, confirmación nativa y diarios previos a cada efecto. Conserva avances
confirmados y bloquea repetir efectos inciertos; undo comprueba cambios manuales
y mantiene etiquetas con mensajes nuevos. Comparte primitivas privadas con
calendario y conserva main/preload/renderer. [Evidencia](../../openspec/changes/secure-gmail-organization-plans/reports/verification.md):
73 casos nuevos, 4682 pruebas aprobadas y 5 omitidas en la compuerta completa,
DPAPI real en tres procesos y build aislado de seis artefactos. No ejecuta correo
real ni adjudica planes heredados sin dueño. Las operaciones directas se abordan
en la unidad siguiente; persisten reconciliación manual de efectos inciertos y
revisión independiente. El índice
global se mantiene sin recalcular hasta una nueva evaluación integral.

[secure-gmail-mailbox-operations](../../openspec/changes/secure-gmail-mailbox-operations/proposal.md)
protege nueve canales directos del buzón con schemas/caller, seis confirmaciones
de escritura y contexto de cuenta compartido con planes. Selecciona todas las
páginas antes de mutar, impide repetir mensajes al conservar origen y conserva
avances tras fallos sin éxito falso. Mantiene el archivo desde INBOX, protege
etiquetas de sistema y distingue conteos desconocidos. [Evidencia](../../openspec/changes/secure-gmail-mailbox-operations/reports/verification.md):
92 casos nuevos, 4774 pruebas aprobadas y 5 omitidas, build aislado de seis
artefactos y custodia DPAPI real. Las operaciones directas no tienen diario de
crash; la política runtime de verificación de etiquetas requiere el siguiente
bloque indicado debajo. Implementada/verificada localmente, revisión
independiente pendiente y sin nuevo porcentaje global inferido.

[constrain-gmail-runtime-feedback](../../openspec/changes/constrain-gmail-runtime-feedback/proposal.md)
retira el verificador que ampliaba el vaciado después de modificar un correo y
el estado Gmail transversal de los ejecutores. Conserva resultados reales,
paginación informativa y asociación call_id; rechaza extras sin promoverlos a
mensajes user. [Evidencia](../../openspec/changes/constrain-gmail-runtime-feedback/reports/verification.md):
32 casos nuevos, 4806 pruebas aprobadas y 5 omitidas, build aislado de seis
artefactos y regresiones de grupos/HITL/servicios hermanos. Implementada y
verificada localmente; revisión independiente pendiente. No implica redacción
integral del historial ni un nuevo porcentaje global.

[minimize-whatsapp-tool-telemetry](../../openspec/changes/minimize-whatsapp-tool-telemetry/proposal.md)
proyecta eventos operativos tool a campos permitidos y evita persistir argumentos,
mensajes o errores libres. Reutiliza la proyección al leer legado, conserva
conteos/flags y usa huellas privadas efímeras para comparar ciclos. Aísla fallos
de registro y sanea excepciones inesperadas de dispatcher/fallback/guardas.
[Evidencia](../../openspec/changes/minimize-whatsapp-tool-telemetry/reports/verification.md):
43 casos nuevos, 4849 pruebas aprobadas y 5 omitidas, tipos/lint/documentación y
build aislado de seis artefactos. Revisión independiente pendiente. Los bytes
heredados, conversación no-tool y custodia/retención global siguen pendientes;
no se infiere un porcentaje global a partir de este resultado.

## Secuencia por áreas

La unidad [harden-select-dropdown-interaction](../../openspec/changes/harden-select-dropdown-interaction/proposal.md)
reduce deuda de teclado/foco/ARIA del selector compartido y mantiene props,
tipos e integración. Incluye opciones dinámicas, prefijos y geometría a 200%,
con pruebas DOM y Chromium temporal; no certifica accesibilidad global. La
[evidencia](../../openspec/changes/harden-select-dropdown-interaction/reports/verification.md)
registra 26 casos nuevos, 4896 pruebas aprobadas y cinco omitidas, seis
comprobaciones nativas y build de seis artefactos, con revisión independiente
pendiente. El seguimiento de IRIS conserva las
precondiciones de servidor/rollout verificadas y no afirma haberlas resuelto.

La unidad [isolate-browser-resource-policy](../../openspec/changes/isolate-browser-resource-policy/proposal.md)
extrae presupuesto/inactividad/timer del coordinador. Corrige la suspensión de
trabajo protegido bajo presión, conserva snapshot, API y capas y admite exceso
temporal con retry cuando no hay candidatas seguras. Su [evidencia](../../openspec/changes/isolate-browser-resource-policy/reports/verification.md)
incluye 21 casos nuevos, 4870 aprobados y cinco omitidos en verify:pr, ocho
comprobaciones nativas y build de seis artefactos. Revisión independiente
pendiente. No se atribuye ahorro medido ni reducción porcentual
global a esta extracción; el coordinador conserva otras responsabilidades.

| Área | Trabajo y criterio de reducción | Dependencia / autoridad |
|---|---|---|
| Seguridad y privacidad | Calendario: schemas, actor/HITL, errores/eventos seguros. Después eliminar claves compartidas del instalador, migrar OAuth cifrado por usuario y revisar resto de IPC. | Backend/credenciales por usuario operativos antes de retirar fallback; rotación/despliegue explícitos. |
| Arquitectura | Checkpoint de sesión extraído con contratos de cierre/perfiles. Continuar por responsabilidades con estado propio del coordinador, preservando su API y pruebas de navegación. | Incrementos propios sin mezclar reescritura ni funcionalidades. |
| Calidad y tipado | Reparar ESLint y reducir any en las fronteras modificadas; baseline total decreciente y cero incidencias nuevas. | No ampliar baseline, no desactivar reglas. |
| Pruebas | Tooling y calendario en el gate. Reproducir fallos del diagnóstico; cobertura medida por rutas críticas, smoke empaquetado y Python. | No subir timeouts globales ni sustituir comportamiento por inspección de texto. |
| Datos e integridad | Transacción de borrado IRIS y estado Lia con ownership; probar CRUD entre actores y rollback. | Confirmar contratos SQL reales; migraciones preparadas/locales, ejecución remota autorizada aparte. |
| Dependencias | Reconsultar avisos actuales, agrupar actualizaciones compatibles, verificar alcanzabilidad y no introducir ganchos nuevos sin revisión. | Lock revisado y pruebas de cada consumidor; no audit fix --force. |
| CI/CD | Gate previo para mismo SHA, Node consistente y Linux completo. Después smoke de bundles/instaladores y firma/notarización. | Este bloque cambia YAML; no ejecuta publicación ni configura secretos. |
| Observabilidad | Calendario con logger estructurado sin payload; ampliar a rutas críticas con correlación y errores por categoría. | No registrar títulos, contenido o tokens como metadata de diagnóstico. |
| Rendimiento | Cancelar/ignorar respuestas obsoletas del panel; después benchmark de navegador y carga/EXPLAIN autorizados. | Conservar presupuestos y comparar mediciones reproducibles, no promesas de 800 usuarios. |
| Documentación | Corregir SQLite, autenticación/RLS y runbooks junto al código; verificar enlaces, scripts citados y estado real. | Archivar cambios sólo después de evidencia y revisión independiente. |
| Accesibilidad/UX | Mantener confirmación contextual y errores visibles; siguiente incremento teclado/foco/zoom/movimiento y auditoría axe. | No declarar certificación por pruebas unitarias. |

## Invariantes

Una unidad termina con evidencia de tipos, lint, pruebas y gate o fallos previos
identificados; incluye contratos, rollback y límites. Se evitan despliegues,
rotación o SQL remoto implícitos. Los datos/funciones existentes se conservan
mediante adaptadores en sus capas. El siguiente bloque se elige por riesgo
residual y pruebas disponibles.

## Control de alcance runtime

La inspección encontró un verificador que ordenaba continuar vaciando etiquetas
después de modificaciones individuales y registraba IDs/errores crudos. El
cambio [constrain-gmail-runtime-feedback](../../openspec/changes/constrain-gmail-runtime-feedback/proposal.md)
retira ese módulo y su estado transversal, preservando los resultados originales
del servicio. El loop no añade lecturas ni instrucciones globales; la paginación
informa disponibilidad como datos. El adaptador rechaza resultados sin llamada
y valida el lote antes de publicar pending. La verificación final y sus límites
se registran en el cambio; no se certifica toda la política semántica del agente.

La unidad [minimize-whatsapp-tool-telemetry](../../openspec/changes/minimize-whatsapp-tool-telemetry/proposal.md)
separa diagnóstico persistente y control de ciclos, proyecta eventos tool nuevos
y heredados al leer y sanea excepciones inesperadas del dispatcher/fallback y
guardas. Conserva conteos, flags y correlación sin argumentos ni textos libres
en telemetría; las respuestas funcionales no se recortan. La evidencia final se
registra en el cambio. Persisten la custodia/retención del historial completo,
sus bytes heredados y los errores que cada servicio captura como respuesta
normal: requieren trabajo por superficie, sin asumir que este filtro los cifra
o sanea todos.

## Precondición de integridad IRIS

La inspección local del 22 de octubre confirma que deleteProject ejecuta cuatro
peticiones independientes e ignora los primeros errores. Además, el snapshot
no contiene project_members (sí pm_project_members), ni describe políticas/RLS
efectivas, y tiene otras dependencias de proyectos/issues. La transacción futura
debe partir del grafo y permisos reales de IRIS, con rollback y pruebas de dos
actores; no se deben inventar tablas o privilegios por compatibilidad con el
código defectuoso. No se ejecutaron consultas ni borrados remotos para esta
inspección local. Evidencia: `src/services/iris-data/projects.ts` y
`database/iris/snapshots/schema.sql`.

La [consulta posterior de metadatos efectivos](../reports/iris-access-2026-10-22.md)
identificó 30 tablas sin RLS, membresías permisivas sin actor, 19 tablas y 23
relaciones en el grafo revisado. No existe un contrato local v1 de borrado ni
equivalencia demostrada con auth.uid() IRIS. El arreglo requiere transacción
autorizada en Project Hub y transición de consumidores, con pruebas de dos
actores y rollback antes del rollout de permisos. Sólo se consultaron catálogos
y asesores: sin registros de negocio ni escrituras remotas. Esta evidencia
actualiza la incertidumbre de DT-03/DT-04; no demuestra su remediación.

## Custodia y ciclo de sesión Project Hub

La unidad [secure-project-hub-session-custody](../../openspec/changes/secure-project-hub-session-custody/proposal.md)
retira el store global síncrono del flujo activo. Reutiliza custodia del SO y
archivos privados con propietario, valida credenciales y separa autenticación,
HTTP y persistencia detrás de la fachada existente. Descarta respuestas
obsoletas, coordina renovaciones y cierra memoria antes de esperar red. Evita
replay de mutaciones, redirects y uso de acceso vencido; acota cuerpos y errores.
La evidencia incluye regresiones rojas/verdes, disco y HTTP locales y DPAPI
entre procesos temporales. No se agregan dependencias ni canales.

El seguimiento de caller/frame y HITL se implementa en la unidad siguiente.
Permanecen la autorización/revocación del servidor, accesos IRIS directos y los bytes del
legado global sin dueño. No se infiere un porcentaje nuevo de deuda a partir
del número de pruebas; el diagnóstico ponderado requiere repetir la evaluación
con la misma metodología. Revisión independiente pendiente antes de archivar.

## Autorización IPC Project Hub

[secure-project-hub-ipc](../../openspec/changes/secure-project-hub-ipc/proposal.md)
cierra el acceso sin ventana, documento/frame/caller válidos y exige
confirmación nativa para las doce mutaciones, con destino comprobado por el
servicio. Conserva 22 canales, schemas y tipos compartidos, snapshot acotado y
contexto interno opcional hasta HTTP. Navegación cancela red/espera y descarta
respuestas previas; la renovación del dueño puede continuar para otros
consumidores. El resultado incierto de una mutación no se presenta como rollback.

Se verifican las cuatro capas con preload/allowlist/wrapper reales y servicio
doble, más HTTP local y carreras con el servicio real. El smoke nativo usa
Electron/IPC/frame/navegación reales y ocho comprobaciones en perfil temporal.
La respuesta del diálogo usa un doble: no acredita prueba humana ni despliegue. Permisos
del servidor, uploader firmado, IRIS directo y legado sin dueño permanecen
fuera de esta remediación. No se agregan dependencias ni permisos runtime.

## Subida de archivos Project Hub

[secure-project-hub-file-uploads](../../openspec/changes/secure-project-hub-file-uploads/proposal.md)
migra selección, bytes y tokens temporales a main. Sustituye dos primitivas
renderer por subir/cancelar con destino e ID, sin rutas o credenciales públicas.
Valida lote/hash/tipo, exige aprobación, relee bytes estables y comprueba
origen/path/token antes de PUT. Una intención por archivo, sin redirects/retry;
complete exige evidencia ready del mismo destino. Conserva avance confirmado y
declara pendientes/incertidumbre sin limpieza remota ni reanudación implícitas.

Pruebas de archivos/HTTP reales locales, lifecycle renderer y Electron aislado;
confirmación/selector se simulan. Las descargas se abordan en la unidad siguiente. Pendientes: huérfanos
tras cierre, permisos/RLS/revocación del servidor y accesos IRIS directos. No
hay SQL ni despliegue ni porcentaje global nuevo sin reevaluar la metodología.

## Copias locales de evidencia Project Hub

[secure-project-hub-file-downloads](../../openspec/changes/secure-project-hub-file-downloads/proposal.md)
retira get-download público y migra URL/token/bytes a main con revisión y destino
nativos. Comprueba evidencia ready no archivada, destino Storage exacto y bytes
por longitud/hash/formato. Publica una copia íntegra exclusiva sin sobrescribir
ni abrir archivos; cancelar conserva el commit real. Reutiliza formato, origen
permitido y slot de operación con subida, manteniendo las cuatro capas.

Las pruebas incluyen disco/HTTP ficticios reales, IPC/renderer y Electron
aislado con selectores simulados. Persisten RLS/revocación del servidor, IRIS
directo, huérfanos/reanudación tras crash y otros flujos asíncronos de la vista.
No hay nuevas dependencias ni permisos runtime, SQL, cuentas reales o despliegue.
La evidencia final y límites se conservan en los reportes de esta unidad; no se
recalcula el porcentaje global sin una nueva evaluación comparable.

## Ciclo de vida de los sidecars Python

[isolate-python-sidecar-lifecycle](../../openspec/changes/isolate-python-sidecar-lifecycle/proposal.md)
retira la duplicación de transporte de voz y documentos en favor de una conexión
por hijo. Impide que exit/error/stdout antiguos invaliden el nuevo proceso;
todos los consumidores esperan ready compatible. Stop invalida intención antes
de esperar, cancela restart y descarta resultados obsoletos. Framing UTF-8,
payload, cola y pendientes tienen límites y errores controlados, sin retry ni
stdout/stderr crudos. Conserva fachadas, dos procesos y consumidores existentes.

Pruebas de carreras/cancelación/errores, hijos Node con stdio real y smoke con
Python de QA para v4/v1; sin audio/modelos ni runtime distribuible instalado.
Permanecen autorización IPC, descargas, entorno heredado y logs semánticos de
estos servicios, así como RLS y deuda global ya registrada. La unidad conserva
evidencia y límites sin deducir un nuevo porcentaje a partir de tests o líneas.

## Autorización integrada de voz local

[secure-local-voice-authorization](../../openspec/changes/secure-local-voice-authorization/proposal.md)
cierra ajustes, Orbe y restauración con caller y consentimiento por sesión;
protege también comandos/notificaciones directos en main. Enabled permanece
como preferencia de máquina, se revoca A/B/A y se dirige dictado/Piper al
consumidor, sin broadcast. Síntesis tiene lectura real limitada y prefetch
acotado/cancelable. Meeting Live conserva su puerto y recibe indisponibilidad
del proceso compartido; no adquiere permisos nuevos.

La unidad reúne pruebas dirigidas/UI y Electron aislado con servicios/diálogos
simulados. No usa audio, modelos ni credenciales reales. Quedan descargas e
integridad de modelos, preferencias globales, logs semánticos, otros IPC y
la deuda global registrada. El porcentaje histórico no se recalcula sin una
auditoría comparable; pruebas aprobadas no equivalen a puntos porcentuales.

## Frontera documental y privacidad Python

[secure-python-document-boundary](../../openspec/changes/secure-python-document-boundary/proposal.md)
autoriza los cinco IPC, mueve selección y copia estable a main y comparte DTO
acotados con preload/renderer. Privacidad persistida con revisión e incertidumbre
observable; desactivar requiere confirmación. Cancelar retira el hijo de
herramientas y difiere limpieza hasta cierre si hace falta, preservando voz.
Redacción incluye nombres de hojas y procedencia Office; lectura protegida
rechaza fallback crudo/visual. Ambos IPC de contexto retiran inventario y
resultados obsoletos al cambiar sesión. No hay canales ni dependencias nuevos.

Evidencia TS/UI, Python de QA y Electron aislado en los reportes de la unidad.
Persisten detección incompleta por patrones, límites duros del parser, copias
tras crash, preferencias globales y la deuda remota/IRIS registrada. No se
publica otro porcentaje sin aplicar de nuevo una auditoría comparable.

## Presupuesto de conversión documental

[bound-python-document-parsing](../../openspec/changes/bound-python-document-parsing/proposal.md)
valida Office antes de bibliotecas y aplica cuotas durante la construcción de
resultados UTF-16. Evita expansión excesiva ZIP/XML, geometría falsa y spans
desmesurados; cierra fuente/libro en error y verifica también texto redactado.
PDF comunica parcialidad con total omitido si no se conoce. Mantiene API,
protocolos, consumidores y las dieciocho unidades previas. Pruebas stdlib y
formatos/stdio QA con comando reproducible, sin nuevas dependencias.

Persisten estructuras internas de terceros, límites duros del SO, diferencias
de versiones QA respecto del runtime y cobertura Python separada del gate Node.
No hay certificación antivirus ni un porcentaje global deducido de estos cambios.

## Dependencias verificadas del lector Python

[secure-python-reader-dependencies](../../openspec/changes/secure-python-reader-dependencies/proposal.md)
retira pdfminer.six vulnerable, fija el cierre del lector y bootstrap con hashes
y hace que sus cambios invaliden la caché de preparación. Comprueba versiones
antes de imports y rechaza PDF en runtimes antiguos. Conserva APIs y staging
recuperable; voz se instala por separado y se comprueba junto al lector.

Estado parcial: wheels verificadas para cuatro targets y ejecución temporal
Windows; falta artefacto seguro macOS Intel. Hay workflow de candidato nativo
preparado, sin ejecución ni publicación. No se rebaja la dependencia vulnerable
para pasar el gate. Persisten verificación nativa por plataforma, patch distinto
del intérprete QA, voz fuera de auditoría integral y revisión independiente.
No se recalcula el índice global histórico a partir de estas pruebas.

## Contratos Python dentro de la compuerta

[gate-python-document-contracts](../../openspec/changes/gate-python-document-contracts/proposal.md)
incorpora el runner stdlib a verify:pr con intérprete obligatorio y fallos
observables. Comparte la descarga existente para preparar temporalmente el
standalone fijado, verificando SHA256 y versión/arquitectura, sin promoción.
CI y release usan matriz reutilizable de formatos con locks exactos para
cuatro targets; los builds esperan ambos gates. Corrige también la preparación
de Python del candidato Intel, cuyo artefacto sigue pendiente y sin ejecutar.
Se conserva la separación de tooling respecto del producto; no cambia parsers,
canales, permisos o bibliotecas runtime. El éxito remoto y la revisión
independiente siguen requiriendo evidencia propia.

## Runtime Electron con barrera de seguridad

[enforce-electron-security-floor](../../openspec/changes/enforce-electron-security-floor/proposal.md)
actualiza Electron 44.5.1 a 44.9.3 y añade rechazo semver de rangos afectados de
GHSA-jr5w-w6x2-84p9. Una excepción beta no puede eludir la barrera; runtime:stable
se ejecuta también en PR y comprueba manifiesto/lock/paquete/binario. Auditoría
comparable: 20 a 19 paquetes afectados, 12 a 11 high, sin afectados nuevos;
el árbol omit=dev permanece en 19 porque npm clasifica Electron como dev aunque
el runtime se distribuya con el producto.

El ejecutable coincide con el ZIP/hash oficial. Se verifican consumidores en
Electron real con perfiles temporales, sin cuentas o despliegue. El smoke zoom
se alinea con el modo aislado existente y conserva comprobaciones de captura y
entrada. Persisten otros avisos, certificación por plataforma/instalador y
revisión independiente. No se infiere otro porcentaje global de estas cifras.

## Intentos OAuth de calendario vinculados y acotados

[secure-calendar-oauth-exchange](../../openspec/changes/secure-calendar-oauth-exchange/proposal.md)
corrige callback sin state y cliente Microsoft confidencial sin credencial,
con rechazo reproducido antes del cambio. Usa state/PKCE por intento, nonce
Microsoft validado por SDK y cliente público, receptor local listo antes de
abrir navegador externo permitido y ventana local sin privilegios. Cancelar,
revocar sesión, fallar o vencer retira listener/conexiones/ventana antes del
resultado. Conserva contratos IPC, custodia, consumidores y scopes existentes.

MSAL 7.1.1 y common 16.14.3 sustituyen 5.5.0/16.12.0; sólo cambia ese cierre.
Auditoría comparable: 19 a 18 paquetes afectados, 11 a 10 high, sin avisos
nuevos; omit=dev también 19 a 18. Los casos TCP, SDK con transporte ficticio y
Electron con navegador sustituido no acreditan cuentas/proveedores reales.
Persisten scopes amplios, secreto Google distribuido, renovación Microsoft,
certificación multiplataforma y revisión independiente. El índice global
histórico requiere nueva auditoría comparable para publicar otro porcentaje.

## Validación acotada y dependencias nativas del parser

[secure-validation-and-onnx-dependencies](../../openspec/changes/secure-validation-and-onnx-dependencies/proposal.md)
fija Zod raíz 4.6.7 y ONNX Runtime/common 1.30.0 con adm-zip 0.6.1. Mantiene
schemas y API; usa el cierre del proveedor sin overrides mayores. La regresión
demuestra que colecciones fuera de cuota dejan de validar 1000 hijos y añade
contrato ZIP real al gate. Inferencia CPU y parser Sharp/NMS se comprueban en
Node/Electron con modelos mínimos propios; no se instalan CUDA ni pesos externos.

Auditoría comparable: 18 a 16 paquetes afectados, high 10 a 8, moderate 8, sin
afectados nuevos. Las dos copias Zod 3 de Jimp permanecen afectadas; la copia raíz
ya no figura como afectada. Cinco binarios Windows coinciden con el tarball npm
verificado por SRI. Persisten otros avisos, detector real/plataformas/instalador,
verificación prolongada del lifecycle del parser y revisión independiente. Estas cifras no
recalculan el porcentaje global de deuda.

## Cierre documental compatible

[secure-document-export-dependencies](../../openspec/changes/secure-document-export-dependencies/proposal.md)
retira uuid 8.3.2 e image-size 1.2.1 mediante overrides limitados a los padres
actuales fijados, sin adaptar el producto a APIs nuevas. ExcelJS conserva v4
sin argumentos; PptxGenJS no importa esa dependencia en sus bundles actuales.
Los contratos verifican buffers/ICNS con guardas, CF/IDs, imágenes, gráficas y
roundtrip/OOXML. Node/Electron ejecutan también el exportador real del Hub.

Auditoría comparable: 16 a 12 paquetes afectados, high 8 a 6, moderate 8 a 6,
sin afectados nuevos. Los contadores no prueban alcanzabilidad de paths
vulnerables. Permanecen Jimp y sus transitivas, revisión independiente y
validación visual/plataformas. Los overrides se retiran al adoptar un cierre
oficial compatible del padre; no se amplían a otros consumidores. El índice
global requiere reauditoría comparable para publicar otro porcentaje.

## Barrera de no regresión verificable

[gate-lint-against-trusted-git-baselines](../../openspec/changes/gate-lint-against-trusted-git-baselines/proposal.md)
cierra falsos verdes de commits comparados consigo mismos, fuentes JS omitidas
y configuración ESLint anidada que anulaba reglas. Resuelve bases Git, usa el
ancestro común para PR y HEAD para cambios locales, exige ambas comparaciones
cuando corresponde y falla ante referencias/parser no verificables. Rutas
literales y fuentes regulares conservan la frontera del workspace.

Incluye ocho extensiones con contextos explícitos y conserva presupuestos por
regla/severidad sin aumentarlos. Pruebas CLI reales y consumidores nativos
verifican las correcciones de tooling; el índice distinto del worktree, la
configuración y CI remoto conservan límites documentados en el
[reporte](../../openspec/changes/gate-lint-against-trusted-git-baselines/reports/verification.md).
No se modifica funcionalidad ni dependencias runtime, ni se publica otro
porcentaje global a partir de estos casos. Revisión independiente pendiente.

## Propiedad y revocación de percepción del navegador

[isolate-browser-perception-lifecycle](../../openspec/changes/isolate-browser-perception-lifecycle/proposal.md)
concentra estado/timer/cachés y trabajos efímeros en un módulo interno integrado.
La regresión demuestra publicación de un frame anterior tras pausar/reactivar;
se corrige mediante propiedad de ciclo/documento y comprobaciones tras esperas.
Conserva coalescencia del destino vigente y serialización por tipo sin abandonar
slots físicos al resetear. Capturas/errores revocados no satisfacen solicitudes
nuevas; no se agregan canales, permisos o dependencias.

El servicio conserva coordinación nativa y guardas de sitio/sensibilidad. Frame
explícito, reproductor y muestreo también fijan ciclo; respaldo UI conserva su
función. Pruebas consumidoras y módulos nativos con datos locales ficticios en el
[reporte](../../openspec/changes/isolate-browser-perception-lifecycle/reports/verification.md).
Persisten cancelación física no disponible, otras responsabilidades del
coordinador, plataformas/CI remoto y revisión independiente. No se infiere un
nuevo porcentaje global de una extracción o del número de casos aprobados.

## Vigencia y publicación de recuperaciones locales

[bound-browser-recovery-review-lifetime](../../openspec/changes/bound-browser-recovery-review-lifetime/proposal.md)
comparte plazo dual y consumo único entre cuatro motores. Las regresiones
demostraron aprobación vencida al atrasar el reloj y publicación después de
cruzar el plazo durante I/O. Revalida cola/proyección/publicaciones y conserva
marcador sync hasta otra revisión, sin cambiar formatos, cifrado o IPC.

Nuevos smokes identificaron EPERM de rename Windows y un bloqueo FileShare.Read
lo reprodujo. Los reintentos acotados sólo publican con archivos/guardas vigentes;
un bloqueo persistente falla sin forzar destino. Se preservan temporales ajenos
y el error original si falla limpieza propia. Se mejoran además readiness y
diagnóstico del fixture de percepción. No se identifica el tenedor histórico ni
se promete publicar bajo cualquier bloqueo. [Evidencia](../../openspec/changes/bound-browser-recovery-review-lifetime/reports/verification.md),
con revisión independiente y validación multiplataforma pendientes. Estos
resultados no recalculan el índice global histórico.

## Publicación síncrona de recuperación compartida

[unify-guarded-recovery-file-publication](../../openspec/changes/unify-guarded-recovery-file-publication/proposal.md)
retira tres implementaciones duplicadas del ciclo temporal/fsync/cierre y
publicación. Las regresiones demostraron error primario oculto por cierre o
limpieza, además de una compensación sync que sustituía el fallo del marcador.
La primitiva integrada conserva causa, guardas y propiedad sin cambiar contratos,
formatos, cifrado o dependencias. Los borrados deliberados mantienen rechazo.

Pruebas consumidoras comprueban archivos/caché/bloqueo y rollback; Electron
ejecuta publicación real y fallos controlados sobre fixtures propios. Se documentan
cierre incierto, residuos y cuotas sin afirmar limpieza completa ni recuperación
ante corte eléctrico. [Evidencia](../../openspec/changes/unify-guarded-recovery-file-publication/reports/verification.md).
Revisión independiente y otras plataformas pendientes; no se infiere reducción
porcentual global de una extracción o un contador de pruebas.

## Modalidad y propiedad de confirmaciones del chat

[harden-action-confirmation-dialog](../../openspec/changes/harden-action-confirmation-dialog/proposal.md)
sustituye la modalidad declarativa por diálogo nativo controlado, foco inicial
seguro, Escape y retorno al invocador. Una identidad efímera renueva los controles
por solicitud y evita aceptar una nueva con el gesto anterior. La presentación
delega resolución sin borrar por su cuenta otra revisión. Conserva políticas,
servicios y límites main/preload/renderer; no agrega dependencias.

Se corrige contraste de las tres acciones principales con la paleta existente;
el contenido largo conserva lectura y acciones mediante scroll a 200%.
Pruebas renderer, contratos consumidores y resultados nativos acotados en el
[reporte](../../openspec/changes/harden-action-confirmation-dialog/reports/verification.md).
Las imágenes defectuosas no cuentan como revisión visual aprobada. Esa revisión,
la ejecución del fixture nativo final simplificado, otras plataformas y revisión
independiente quedan pendientes; el rechazo de apertura del archivo local por
la política del navegador no se eludió. El índice global requiere otra auditoría
comparable y no se recalcula contando pruebas o archivos refactorizados.

## Resolución compatible de peers de imágenes

[constrain-legacy-image-peer-resolution](../../openspec/changes/constrain-legacy-image-peer-resolution/proposal.md)
acota los peers abiertos de scale/shadow 0.22.12 al conjunto Jimp compatible ya
consumido por nut-js/shared. Retira veinte paquetes físicos y cambia tres sin
scripts de instalación ni APIs nuevas. Contratos reales prueban imágenes,
píxeles, RGB/BGR, proveedores y errores en Node y Electron en modo Node, sin UI
o interacción con el escritorio. No se modifica main/preload/renderer ni permisos.

Auditorías comparables completa y de producción: doce a siete paquetes afectados,
seis a cero high; siete moderate, incluido core reclasificado de high a moderate.
No aparecen paquetes/nodos afectados nuevos; el aviso directo Zod desaparece
con su subárbol. File-type 16 y su cadena siguen pendientes. La reducción no
demuestra ausencia de vulnerabilidades o un nuevo porcentaje global de deuda.
[Evidencia](../../openspec/changes/constrain-legacy-image-peer-resolution/reports/verification.md),
con revisión independiente, otras plataformas e instalador pendientes.

## Vigencia de la cola y publicación del chat

[preserve-pending-chat-sync-intent](../../openspec/changes/preserve-pending-chat-sync-intent/proposal.md)
ordena sincronización por identidad con una pasada activa y una pendiente
fusionada. Revalida el contenido antes/después de red y sólo reconoce una
retirada persistida. El cache adelantado a la cola también queda protegido;
prioridad de borrados/lápidas y exclusión de otra identidad se conservan.
No agrega tablas, formato local, permisos, dependencias ni canales IPC.

La regresión reproduce pérdida de pendientes, publicación atrasada y efectos
solapados; pruebas consumidoras conservan guardado y borrado. La
[evidencia](../../openspec/changes/preserve-pending-chat-sync-intent/reports/verification.md)
separa control local de concurrencia de CAS/atomicidad entre ventanas o equipos,
que siguen pendientes. No puede revocar I/O ya enviado ni garantizar persistencia
con almacenamiento fallido. Revisión independiente pendiente, sin recalcular el
índice global desde un número de pruebas o una extracción.

## Sesión vigente de sincronización del chat

[bind-chat-sync-to-lia-session](../../openspec/changes/bind-chat-sync-to-lia-session/proposal.md)
añade revisión efímera del sujeto/ciclo SDK Lia a cada lote. Cierre/cambio y
A/B/A revocan trabajo anterior, sin reconocer ni publicar respuestas obsoletas;
se conservan pendientes para una solicitud nueva válida. Los scopes revocados
no amplían otro ciclo y el listener se retira al quedar ocioso. No agrega
permisos, tablas, formato, dependencias ni canales main/preload/renderer.

La [evidencia](../../openspec/changes/bind-chat-sync-to-lia-session/reports/verification.md)
incluye regresiones, SDK ficticio y adaptador con SDK Supabase real y transporte
ficticio, sin red/cuentas reales. getSession refleja al cliente, no sustituye
verificación de JWT/RLS del servidor. El cierre global de AuthContext/login/SSO,
I/O enviado y coordinación entre equipos conservan sus límites. Revisión
independiente pendiente; no se deriva un nuevo porcentaje global de estas pruebas.

## Vigencia de restauración y eventos de autenticación

[guard-auth-lifecycle-results](../../openspec/changes/guard-auth-lifecycle-results/proposal.md)
protege lectura inicial, eventos y continuaciones Lia con una señal por
operación. Suscripción previa a lectura, invalidación A/B/A y limpieza impiden
publicación, denegación o carga de operaciones superadas. Cancelar evita iniciar
refresh/canje/OTP/retry siguientes; el perfil se sincroniza una sola vez al
aceptar y su rechazo auxiliar no revoca una sesión válida.

La [evidencia](../../openspec/changes/guard-auth-lifecycle-results/reports/verification.md)
distingue cancelación local de llamadas SDK ya enviadas y de los productores
explícitos login/SSO/reintentos/signOut, cuyo arbitraje global sigue pendiente.
Sin permisos, canales IPC, dependencias o formatos nuevos. No hay nuevo índice
global ni archivo del cambio sin revisión independiente.

## Ownership de intenciones de autenticación

[coordinate-authentication-intents](../../openspec/changes/coordinate-authentication-intents/proposal.md)
integra login, SSO, restauración/eventos, reintentos y cierre mediante una señal
por intención y una cola acotada de mutaciones SDK. Una llamada física revocada
no publica ni cancela por su evento tardío al acceso nuevo en espera. Cierre
retira perfil local y publica no autenticado sin esperar red/lectura de tokens;
SSO conserva cancelación incluso tras reclamar el retorno. Las recuperaciones
y servicios revisan vigencia antes de etapas posteriores.

[Evidencia](../../openspec/changes/coordinate-authentication-intents/reports/verification.md)
del proveedor real, servicios y SDK Supabase con transporte ficticio. Ownership
es local a ese proveedor: I/O enviado, SDK de otras ventanas/equipos, RLS/JWT,
identidad de perfil y despliegue conservan contratos propios. La cola espera
I/O vivo; no declara progreso físico de un proveedor que no responde. Sin
dependencias, formato o IPC nuevos ni porcentaje global inferido. Revisión
independiente pendiente, sin archivar.

## Fuente nativa de publicación de autenticación

[authorize-auth-state-publication](../../openspec/changes/authorize-auth-state-publication/proposal.md)
autoriza en main al Hub como publicador y a Hub/Orbe como lectores. Comparte
la lease de ventana/marco/documento con las guardas autenticadas, sin exigir
sesión previa al bootstrap. Acota payloads, impide revelar identidad a fuentes
denegadas, revalida esperas y libera listeners; el DTO conserva cuatro capas.

[Evidencia](../../openspec/changes/authorize-auth-state-publication/reports/verification.md)
de contratos y consumidores con puertos nativos sustituidos, sin GUI/cuentas
reales. No cambia políticas de servidor ni revierte efectos internos de SDK
ya invocados. Sin dependencias o canales nuevos; revisión independiente
pendiente y sin porcentaje global nuevo deducido de esta unidad.


## Continuidad al 5 de noviembre de 2026

La generación de imágenes y [Flow/dictado](../../openspec/changes/move-flow-gemini-to-main/reports/verification.md)
tienen rutas nativas en Electron. Las lecturas y mutaciones de claves incluyen
revocación de sesión y errores públicos; no se ha retirado Gemini de todos los
consumidores ni del bundle público. El último índice global publicado sigue
siendo histórico y requiere reevaluar los criterios completos.

Orden de cierre pendiente: migrar los restantes consumidores Gemini (chat,
medios e investigación); verificar aislamiento e integridad de datos; reducir
concentración y tipado débil; validar integración de ramas; completar revisión
independiente y entrega por plataforma. RLS, transacciones y pruebas de carga
requieren evidencia de servidor; firma y notarización requieren sus entornos.
No hay entorno macOS Intel disponible para acreditar su artefacto seguro.
Estas brechas no quedan cerradas por las pruebas locales de renderer/main.

## Recursos físicos y credenciales de medios (5 de noviembre)

Las subidas de medios resuelven la credencial en main; el renderer conserva el
consentimiento ligado a sesión. El servicio limita cuatro subidas físicas por
instancia y mantiene las plazas hasta que termina la llamada del SDK. La
invalidación revoca resultados, incluidos fallos y cancelaciones tardíos, sin
restaurar registros de otra sesión. No conserva clientes indexados por clave.

La unidad `bound-native-media-resources` registra verificación y límites. No
acredita cancelación física de red, retención acotada de todo el historial ni
pruebas con proveedor real. Gemini chat/investigación, aislamiento e integridad
de datos, tipado, concentración de módulos e integración de ramas siguen
pendientes. La revisión independiente y la entrega por plataforma tampoco se
sustituyen por estas pruebas. No se publica un porcentaje global nuevo sin
reevaluar los 44 criterios de la metodología vigente.

## Matriz de cierre pendiente por área

Esta matriz organiza brechas abiertas del diagnóstico y la implementación
acumulada; no constituye una nueva puntuación de los 44 criterios. Cada cierre
requiere evidencia del comportamiento y de sus consumidores, además del gate.

| Área | Siguiente trabajo de cierre | Evidencia necesaria para aceptar |
|---|---|---|
| Seguridad y privacidad | Retirar la credencial Gemini del build público y del paso por ajustes/WhatsApp; revisar los canales restantes | Renderer Electron sin resolver credenciales de proveedor; contratos negativos por fuente, sesión y permisos; [seguridad](../security/security-and-privacy.md) |
| Arquitectura y modularidad | Separar responsabilidades del navegador y componentes extensos conservando APIs públicas | Contratos de consumidores y pruebas de compatibilidad antes/después; [arquitectura frontend](../architecture/frontend.md) |
| Calidad y tipado | Reducir baseline de lint, tipos débiles y errores silenciosos | Descenso por regla/severidad, tipos de frontera y errores controlados; [estándar](../standards/engineering-practices.md) |
| Pruebas y calidad funcional | Completar E2E del producto empaquetado y de integraciones | Flujos reales reproducibles con éxito, fallo, cancelación y cambio de sesión; [estrategia](../quality/test-strategy-and-inventory.md) |
| Datos e integridad | Verificar ownership/RLS y sustituir borrados separados de IRIS por operación transaccional | Pruebas entre organizaciones, rollback e integridad en la instancia correcta; [datos](../standards/database.md) |
| Dependencias y suministro | Cerrar brechas de artefactos y matriz Python por plataforma | Locks/artefactos verificados, pruebas de formatos y evidencia por plataforma; macOS Intel pendiente sin entorno disponible |
| CI/CD y publicación | Acreditar integración entre ramas, matriz, firma y notarización | Gate del commit integrado y artefactos firmados verificables; [release](../operations/release-and-recovery.md) |
| Observabilidad y operación | Extender logs estructurados, correlación y diagnóstico | Reconstrucción de fallos sin cuerpos sensibles y alertas con propietario; [operación](../operations/development-and-devops.md) |
| Rendimiento y escalabilidad | Acotar historial de medios, comprobar consultas y presupuestos bajo carga | Mediciones reproducibles de memoria, latencia y concurrencia; [carga](../architecture/load-and-scalability.md) |
| Documentación y gobierno | Contrastar runbooks con ejecución y revisar cambios OpenSpec acumulados | Enlaces/catálogo válidos, revisión independiente y evidencia de cierre por cambio; [documentación](../standards/documentation.md) |
| Accesibilidad y UX | Completar auditoría de teclado, semántica, movimiento y regresión visual | Comprobaciones automatizadas y manuales de flujos principales; [accesibilidad](../ux/accessibility.md) |

Orden por riesgo: credenciales y permisos; integridad de datos; compatibilidad e
integración; mantenibilidad y operación; rendimiento y accesibilidad. La entrega
por plataforma y los casos con cuentas reales requieren sus entornos y permisos.
No se presume que un merge incluya los cambios locales sin commit ni que la
compilación aislada acredite la aplicación instalada.

## Credencial nativa de investigación (7 de noviembre)

Main resuelve Gemini dentro de la cuota de investigación y revalida sesión antes de
iniciar HTTP o publicar. El contrato IPC transporta modelo, contexto e ID. Los
reintentos en Electron usan la credencial autorizada por main. El modo web
conserva selección personal y de entorno. Al cierre de ese lote quedaban chat,
especialistas, acciones locales y configuración pública. Ver [evidencia del lote](../../openspec/changes/native-grounding-credentials/reports/verification.md).

## Conversación Gemini en main (7 de noviembre)

Chat general, especialistas, acciones de investigación, títulos, redacción y
optimización usan la conversación nativa. El turno conserva historial curado,
cuotas y revocación. El SDK fija el endpoint Gemini y el renderer mantiene su
dispatcher. Quedan la publicación de VITE_GEMINI_API_KEY y su paso por ajustes a
WhatsApp, además de las demás áreas del plan. Ver [evidencia del lote](../../openspec/changes/native-gemini-conversation/reports/verification.md).

## Retirada del proveedor Google de IA (7 de noviembre)

El usuario indicó retirar Gemini de modelos y herramientas. El cambio
[retire-google-ai-provider](../../openspec/changes/retire-google-ai-provider/proposal.md)
sustituye la continuidad anterior de adaptación de Gemini. El catálogo ofrece
SofLIA y Max sobre OpenAI, migra preferencias retiradas, excluye claves de
renderer/preload y retira su tránsito por ajustes. Los equipos en segundo plano
usan OpenAI y reconcilian trabajos guardados. El arnés de análisis de reuniones
usa OpenAI o Codex. Su proveedor Gemini fue retirado.

El alcance integral sigue abierto para chat y sus rutas antiguas, Flow, imágenes,
audio, embeddings, inferencia de reuniones, WhatsApp, control visual y servicios
auxiliares. Al terminar se retirarán SDK, endpoints, handlers y configuración
restantes. La revisión independiente y la acreditación de cada capacidad siguen
los criterios del cambio. Esta fase no acredita la retirada total.


### Continuidad: medios y utilidades OpenAI

El usuario confirmó distribución sólo de escritorio. Imágenes y Flow (análisis,
fallback y dictado) usan OpenAI en main y requieren puente nativo. Se retiraron
sus fallbacks web y SDK anteriores, conservando cuotas físicas y revocación.
Los especialistas, títulos, redacción y optimización usan Responses sin
herramientas. El optimizador ya no ofrece Gemini como destino. El chat heredado,
audio de WhatsApp, embeddings, inferencia de reuniones, control visual y otros
auxiliares todavía requieren migración; no se declara retirada integral.

La simulación por ruta contra los commits indicados encontró solapamientos con
conflicto. Los dos commits también presentan conflictos entre sí. La simulación
no aplica un merge ni acredita compatibilidad semántica de un resultado combinado.


La clasificación/extracción de reuniones y las tareas JSON del workspace también
usan Responses con credencial nativa de sesión. Se retiraron sus setters Google
y se conserva la validación de schemas y aprobación de acciones. La migración
integral aún requiere las capacidades del inventario operativo restante.


## Reevaluación global del 7 de noviembre

La [reevaluación de los 44 criterios](../reports/technical-debt-reassessment-2026-11-07.md)
sitúa el índice experto en 38,875% (aproximadamente 39%), frente a 40,875% anterior.
No acredita retirada integral ni un producto combinado entre ramas. La mejora de
credenciales compensa parcialmente avisos nuevos de herramientas de desarrollo.
Los conflictos de integración y la migración restante se registran por separado.
