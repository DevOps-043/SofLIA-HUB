# Reducción progresiva de deuda técnica

Estado: en ejecución. Actualizado: 2026-10-22.

Base: [diagnóstico](../reports/technical-debt-2026-10-19.md). Es un índice experto,
no una medida de costo. Se preserva la fotografía histórica; no se reduce su
porcentaje sólo por cerrar tareas. El umbral solicitado se interpreta como deuda
de hasta 5% exenta: ninguna área evaluada cumple ese umbral.

## Unidades

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
