# Propiedad e invalidación de percepción del navegador

Estado: implementación y verificación final aprobadas; revisión independiente pendiente.
Fecha: 2026-10-25; trabajo iniciado el 24. Unidad 27 acumulativa.

## Problema y refactor integrado

La regresión con API pública dejó capturePage pendiente, pausó/reactivó y
comprobó que su frame no se publicara. Antes falló: lastCapturedAt recibió la
fecha del frame anterior en vez de null. Ese resultado confirma la carrera,
sin usar cuentas, modelos o control de escritorio reales. El log rojo conserva
un caso fallido y 247 no seleccionados; no es un reporte de la suite completa.

BrowserPerceptionState concentra estado efímero, timer, cachés, secuencia y
propiedad de trabajos. Cada lease fija ciclo, token de pestaña, documento/carga,
contents, revisiones visual/de política/de control y generación de sesión. Pausa/reactivación no revive
trabajo anterior. Sólo destino/ciclo vigentes comparten resultado; un trabajo
físico retirado conserva el slot hasta settle. La siguiente solicitud espera
y produce de nuevo, sin solapamiento adicional ni finally que borre otro job.

El servicio mantiene política de sitio, documento sensible, captura/DOM y sus
cuatro capas. Comprueba vigencia después de esperas y antes de efectos, también
en frame explícito, reproductor y muestreo. Los errores revocados no se publican;
el timer revalida antes de su microtask. Cerrar pestaña retira tokens/cache para
no retener IDs cerrados. Respaldo UI local conserva su función durante pausa.
No cambia canales, formatos serializados, persistencia, cadencias o dependencias.

El coordinador conserva las operaciones nativas y delega propiedad de estado;
el conjunto productivo crece para expresar las guardas. No se presenta mover o
reducir líneas como una reducción porcentual: la mejora es propiedad verificable
del ciclo de vida y carreras corregidas. Quedan otras responsabilidades en
el coordinador. Fuente canónica:
[arquitectura](../../../../docs/architecture/integrated-browser-platform.md#ciclo-de-vida-de-percepción).

## Pruebas y recorrido nativo

La última suite dirigida aprobó 275 casos: 254 del servicio y 21 del módulo.
Frente a 247 casos anteriores del servicio se añaden 28 en total. Incluye
coalescencia, dos ciclos serializados, siete cambios de identidad con URL igual,
errores revocados, revocación externa, cola obsoleta, reset antes del primer
microtask, secuencia sólo vigente, invalidación por tab y timers. El servicio
prueba frame pendiente, frame/error explícitos revocados, política/sensibilidad
en espera, política revocada durante frame pasivo y cierre de pestaña. La pausa
de percepción no invalida el respaldo UI.

`npm run browser:smoke:native -- --electron RUTA_ABSOLUTA` aprobó 124
comprobaciones en doce fases de Electron 44.9.3 Windows/x64. Las últimas
guardas aprobaron también perception-only: siete casos, exit 0. Módulos de
percepción/DOM productivos con página HTTP local propia, perfiles aislados y
red externa bloqueada comprueban capturePage/PNG, DOM en mundo aislado, pausa,
coalescencia, navegación ABA, revocación de política, cierre y timer. Máximo observado de productores
simultáneos: uno. Las promesas de QA retienen resultados reales para hacer
determinista la carrera; no sustituyen capturePage por un mock.

El smoke verifica módulos y composición de QA, no el servicio completo. Sus
guardas se verifican mediante pruebas consumidoras separadas y compilación.
Las once fases previas de navegación/recuperación/privacidad/zoom/permisos
permanecen en el recorrido; no se acredita instalador o sesiones externas.

Correcciones del arnés durante desarrollo:

- Transpilación inicialmente duplicaba cdp-session y falló con EEXIST; se retiró
la entrada duplicada conservando escritura exclusiva.
- La aserción DOM usó name para el texto de botón. La inspección del resultado
y contrato mostró name vacío y text=Continuar; se comprueban ambos campos y tag
sin cambiar el parser productivo ni rebajar el caso.
- Una descripción general del alcance estaba en limitations, que el runner
interpreta como fallo funcional (exit 2); pasó a scope, conservando su texto.
- El primer recorrido completo falló en policies tras seis comprobaciones y
sin diagnóstico de causa. Se añadió diagnóstico sólo al reporte del sandbox
ficticio, sin imprimir contenido. La fase aislada pasó sus 19 comprobaciones y
el recorrido completo siguiente pasó. No se atribuye causa al refactor o al SO:
no se pudo reconstruir el error original. Se conserva como incertidumbre de
estabilidad para futura observación, sin ocultar el intento fallido.
- El caso de sensibilidad inicialmente no activaba agentGovernance y no entraba
a esa inspección. Se habilitó el flag en el fixture, con evaluación permitida
ficticia, y se restauró al terminar. No se cambió el default del producto.

## Autorrevisión adversarial y límites

Se intentó refutar pausa/reactivación como ABA, mismo URL con documento/vista
distintos, errors tardíos, publicación tras espera de política, crecimiento de
capturas por reset, limpieza de slots ajenos, token de pestaña cerrada y timer
entre callback/microtask. La revisión corrigió guardas de error explícito y
microtask antes de cerrar. Un slot se instala antes de callbacks y se retira en
finally bajo identidad; incluso invalidación antes del primer microtask libera
su propiedad sin producir. Los contadores/IDs sólo se publican si sigue vigente.

El primer gate completo aprobó 5772 casos, pero otra hipótesis de autorización
no estaba cubierta: cambiar política durante un frame pasivo. Su regresión
posterior falló con lastCapturedAt no nulo. La política explícita ya cambiaba
su revisión antes de guardar; la captura pasiva no la fijaba. Se incorporan
revisiones de política/control al destino, se retira la caché antes del guardado
y se prueban servicio y frame nativo reales. Se conserva ese gate anterior como
evidencia histórica, sin usarlo para declarar correcta la revisión posterior.

No hay cancelación física de capturePage. Un trabajo nativo sin resolver puede
demorar el siguiente de ese tipo; capturing refleja que su slot físico aún no
terminó. La ruta de frames explícitos conserva su límite/cadencia independientes;
no se afirma serialización global de todas las API de captura. Lectura manual y
backdrop no se convierten en agentes de percepción. El callback de sensibilidad
sigue condicionado al flag existente; no se presenta como clasificación universal.

Sin secretos/.env, SQL, cuentas reales, envío de mensajes/archivos, commit,
push o despliegue. Se preserva el trabajo ajeno. IRIS y artefacto Python Intel
mantienen sus bloqueos externos. El índice experto histórico de 50.375% no se
recalcula desde tests o tamaño del módulo. Revisión independiente pendiente;
el cambio no se archiva. Reversión selectiva requiere conservar las regresiones
de revocación, sin deshacer otras unidades o volver a publicar frames obsoletos.

## Verificación final

La compuerta final `npm run verify:pr` aprobó sus trece etapas, exit 0 en
310.75 s. Vitest aprobó 5775 casos y omitió cinco, con 504 archivos aprobados
y dos omitidos (506 total); duró 191.08 s. Se añaden 28 casos respecto de la
unidad 26. Aprobaron también 48 pruebas Node del tooling, 33 contratos Python
stdlib con standalone 3.12.11, tipos, suministro/política Electron, harness,
OpenSpec y documentación. El lint revisó 365 fuentes sin deuda nueva; el
inventario contiene 683 archivos de prueba y se validaron 739 Markdown activos.
[Recibo de compuerta](gate-summary.json).

El build aislado aprobó en 68.68 s, con seis artefactos no vacíos, sin .env,
empaquetado o arranque del Hub. Sus 3465 fuentes existentes copiadas coinciden
por SHA256 con el worktree. sourceFiles enumera 3466 rutas Git: incluye la
eliminación previa de electron/wa-agent/bulk-label-verification.ts, que se
comprueba ausente también en el sandbox zn07bN; no se restaura ni se presenta
como copiada. [Build](build-summary.json).

Las 3485 fuentes de build/Python/workflows/configuración ESLint quedaron
idénticas antes y después del gate/build, con SHA256 de inventario
3be2bf28b4613f4b7aefe61abf895dd95c5e88aa67df5027b2504c6400a96ca0.
Se contrastaron además seis módulos del smoke focalizado contra su
transpilación actual y los hashes de los cinco PNG propios. Las doce fases
nativas de la revisión final suman 124 comprobaciones aprobadas. Se conservan
el intento fallido de políticas y la regresión roja posterior al primer gate.
[Fuentes](source-evidence.json), [nativo](native-summary.json),
[logs](log-evidence.json).

Node local 26.7.0 y Electron 44.9.3 Windows/x64; CI Node 24 y otras plataformas
no ejecutados aquí. Avisos de bundler/Vite/localStorage permanecen visibles,
sin ampliar límites o añadir omisiones. Tras estas comprobaciones sólo se
completan documentación/evidencia/tareas y se revalidan enlaces, documentación
de sistema, harness y OpenSpec estricto. Revisión independiente pendiente;
no se archiva ni se declara deuda global resuelta.
