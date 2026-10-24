# Autorización IPC de Project Hub

Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente; revisión independiente pendiente.

## Resultado

Se cierra el fallo abierto de assertSender: ausencia de ventana/proveedor,
caller ajeno, subframe/documento distinto o frame separado deniegan antes de
servicio. Se usa el helper común con invalidación por sesión/navegación/crash
y limpieza de listeners. El rechazo de frame separado también endurece los
consumidores calendario/Gmail; sus regresiones se repitieron.

Se conservan [22 canales y 26 métodos de servicio](contract-comparison.json).
Los veinte métodos con payload, status y retry admiten un último argumento
opcional de autorización main; sus argumentos de negocio previos se conservan.
No se transporta esa autorización desde renderer. Preload y wrapper comparten
tipos de entrada; updateTask completa la ruta existente que carecía de wrapper.
El consumidor valida el rol y conserva type=tab literal al crear colecciones.

Los schemas derivan del código local de Project Hub v1; su ruta y SHA-256 están
en el informe de contrato. Se cierran objetos de dominio y envelopes IPC; se
mantiene metadata JSON bajo cuotas. Se endurecen URLs de pestañas a HTTP(S)
sin userinfo, updates vacíos y fechas ordenadas. No se inventan campos ni se
introducen defaults distintos de los que aplica el servidor. Esto no acredita
que la versión inspeccionada esté desplegada.

Cada mutación comprueba sesión/workspace y, cuando existe, nombre/IDs del
proyecto antes del diálogo. Las doce escrituras requieren confirmación nativa
con cancelar por defecto, 120 s de vigencia y exclusión mientras el diálogo
anterior siga abierto. Se muestran usuario, destino comprobado y alcance de
datos; textos grandes/listas se resumen avisando que se comparten completos.
No se presenta una muestra como vista íntegra. approved=true del payload no
sustituye HITL. Intención de subida y confirmación tienen aprobaciones propias.

La autorización llega hasta el lease de sesión y HTTP: se comprueba antes y
después de esperar; cancelación aborta red o retira la espera. La renovación
compartida del propietario puede continuar para otros consumidores. Una
respuesta anterior no vuelve al nuevo contexto. Si una mutación fue invocada
y su resultado no es verificable, uncertain/recoveryRequired indican
incertidumbre conservadora, sin afirmar envío, rollback ni reintento seguro.

## Evidencia ejecutada

Logs propios: `%TEMP%/soflia-project-ipc-2026-10-22/`.

| Comprobación | Resultado y evidencia |
|---|---|
| Baseline de handlers | Cuatro casos, salida 0; baseline.log. Gate previo: 4964 aprobados y cinco omitidos. |
| Regresiones antes de implementar | Ocho fallos reproducidos: proveedor/ventana/subframe/origen/sesión, aridad, HITL y campo ajeno; regressions-red.log. |
| Revisión de cancelación | Un fallo reproduce espera retenida mientras load sigue pendiente; cancel-wait-red.log. Se retira la espera del caller sin cancelar renovación compartida. |
| Suite dirigida | 393 casos en 16 archivos, salida 0; directed-final.log. Incluye todas las suites Project Hub, auth-state y consumidores comunes calendario/Gmail. |
| Tipos/lint | Aprobados en gate final; 173 archivos sin deuda nueva. Dos intentos previos detectaron mocks sin firma/overload, literal tab y rol demasiado amplios, uso de at fuera de lib y variable de fixture no utilizada; se corrigieron sin relajar configuración ni baseline. |
| HTTP real loopback | Servicio real y servidor local con credenciales ficticias: navegación aborta POST, no envía negocio tras restore y caller cancelado no cancela renovación compartida con otro consumidor. project-hub-ipc-http.test.ts; no cuenta remota. |
| Cuatro capas | createSafeIpc/allowlist, preload, handler y wrapper reales, servicio doble. Éxito de los 22 métodos, canal inventado rechazado, cancelación/incertidumbre conservadas y modo fuera de escritorio explícito. project-hub-bridge.test.ts. |
| Electron nativo | Ocho comprobaciones aprobadas con Electron 44.5.1; [informe](native-ipc.json), native-reviewed.log. Ventanas ocultas, sandbox/contextIsolation, frame/IPC/navegación reales, perfil temporal y red bloqueada. Servicio y respuesta del diálogo simulados. |
| Build aislado | app:smoke:build, salida 0: 3334 fuentes, seis artefactos y hashes de diez archivos afectados iguales al worktree. [Resumen y huellas](build-summary.json), build.log. Sin .env, empaquetado ni bootstrap. |
| Gate completo | verify:pr completado: 5160 casos aprobados y cinco omitidos; 469 archivos aprobados y dos omitidos, 206,22 s de suite. Son 196 casos nuevos respecto al gate anterior. [Resumen](gate-summary.json), verify-pr.log. |
| Documentación y especificación | Inventario derivado: 641 archivos de prueba y 494 canales; OpenSpec estricto válido. Verificación de enlaces y sistema incluidas en gate. Los reportes/tareas finales se vuelven a validar al entregar. |

El primer smoke nativo esperaba la promesa executeJavaScript cuyo contexto se
destruyó durante navegación. El watchdog terminó el proceso a los 45 segundos;
no se consideró éxito. Se corrigió el arnés para observar la respuesta en main
y verificar allí descarte/incertidumbre/listeners, sin esperar el contexto JS
retirado. El smoke posterior finalizó correctamente en perfil temporal nuevo;
native-first.log conserva el intento fallido.

## Autorrevisión adversarial

Se intentó refutar caller con ventana ausente/ajena, documento externo,
subframe, frame separado, registro retirado y A/B/A. Se comprobaron payloads
con campos de autoridad desconocidos, controles, ciclos, getters, prototipos,
tipos no JSON, nodos/profundidad y bytes UTF-8 excesivos. Cambiar el objeto
original durante el diálogo no cambia el snapshot ejecutado.

Se probaron las doce mutaciones canceladas, las 22 aridades, diálogo expirado
todavía abierto, aceptación tardía y datos descartados después de navegación.
Se comprobaron workspace/proyecto no resolubles o discordantes antes de HITL,
destino/rol visibles y errores inesperados sin texto sensible. La cancelación
durante custodia y HTTP cubre el salto asíncrono que no resuelve una guarda
sólo al entrar al handler. El wrapper conserva incertidumbre; no convierte un
efecto sin verificar en éxito ni en rollback.

La revisión propia encontró espera retenida y fortaleció destino comprobado y
frame separado. No constituye revisión independiente: no se archiva el cambio.

## Límites y reversión

La prueba nativa no verifica interacción humana con el diálogo; su respuesta
se simula. No hay prueba con cuenta real, API desplegada, instalador ni SLO.
El catálogo de workspaces del canje puede estar desactualizado: un workspace
nuevo requiere repetir autenticación. Comprobar destino no concede roles ni
reemplaza permisos/RLS del servidor.

Pendientes: validación de URLs firmadas, token temporal, bytes y lifecycle del
PUT del uploader renderer; transición de accesos IRIS directos y permisos del
servidor, revocación JWT y legado de sesión sin propietario. Las 30 tablas IRIS
sin RLS documentadas anteriormente no se consideran remediadas por esta unidad.
La eliminación de proyectos conserva su pendiente transaccional del backend;
no se sustituye por archivado. No se recalcula porcentaje global por casos de
prueba ni se afirma deuda cero.

Revertir conjuntamente handler, schemas/tipos, contexto opcional, wrapper y
pruebas de esta unidad; conservar custodia y doce unidades previas. No hubo
escrituras remotas ni migraciones que revertir, ni commits/publicación en esta
entrega. Volver al handler anterior reabre fallos; no es mitigación de seguridad.
Revisión independiente pendiente antes de archivar.
