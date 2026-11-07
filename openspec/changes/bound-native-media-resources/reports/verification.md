# Verificación de recursos de medios

Actualizado: 2026-11-06. Estado: verificación local aprobada; revisión propia,
no independiente. Proveedor, archivos y credenciales de las pruebas son ficticios.

## Alcance y regresiones

Máximo cuatro subidas físicas por instancia compartida de main. El contador se
libera en finally después de concluir el SDK, incluso si la sesión se invalida.
Se retira el mapa de clientes indexado por clave. Las guardas de sesión evitan
restaurar registros ante fallo tardío o al terminar un borrado de cancelación.

La prueba de cancelación reprodujo publicación indebida (fulfilled en lugar de
rejected), y pasó al revalidar después del borrado remoto. La prueba inicial de
clientes detectó una construcción donde se esperaban dos. El exceso de subidas
quedaba pendiente antes de introducir cuota; la prueba inicial terminó por timeout.

Pruebas focalizadas: 20 aprobadas del servicio, handler y recursos; 5 de
consentimiento en ejecución separada, tras corregir su selector de ruta. Además,
13 del navegador sensible tras estabilizar su fixture. Todas con código 0. Typecheck y ESLint dirigido: código 0. Compilación aislada
`npm run app:smoke:build`: código 0; no acredita instalador ni arranque.
Mantiene avisos de tamaño de chunks, sin modificar sus umbrales.

Logs, JSON de regresión y respaldo previo del servicio:
`%TEMP%/soflia-bounded-media-2026-11-05/`.

## Revisión propia

Se intentó refutar la cuota mediante invalidación con cuatro llamadas vivas:
no libera plazas anticipadamente. Se verificó fallo tardío y cancelación con
borrado remoto pendiente: no recrean registros de otra sesión. La caché del módulo
SDK sigue siendo compartida; el cliente con clave se crea por operación. No se
cambia autorización IPC, dependencia, canal ni pisos de cobertura/lint.

## Límites

La cuota corresponde a upload, no a todos los get/delete ni a todas las instancias
posibles. No interrumpe una llamada SDK viva ni limita todo el historial y mapas
remotos; limpieza remota de mejor esfuerzo. No acredita red, cuentas reales,
paquetes por plataforma, integración entre ramas ni RLS. La eliminación global
de deuda y un porcentaje nuevo requieren evaluar las demás áreas.

Revisión independiente y archivo del cambio pendientes.

## Incidencia de ejecución

El primer verify:pr terminó con código 1 en runtime:stable: el proceso no
acreditó la versión. Una comprobación posterior del mismo ejecutable y los
mismos parámetros devolvió estado 0, stdout 44.9.3 y stderr vacío. Se conservan
el log y código fallidos (`gate-first-failed.*`) y se repite el gate completo.
La causa del primer fallo no está acreditada; no se relajan tiempo ni política.

## Huellas del código verificado

- `electron/media-input/service.ts`: SHA-256 `91bdbfa23a3174a8400c9463304b3dd9dc7c8006b5b1c2eba98f45662c1c93ba`.
- `electron/__tests__/media-input-resources.test.ts`: SHA-256 `df601e074ffc6fe63c29fbe6244483eeb2c835884032048150113345ba994135`.

## Timeout de verificación y corrección de fixture

La segunda compuerta terminó en código 1: 7053 pruebas pasaron, 5 se omitieron
y una del presupuesto documento/shadow DOM excedió 15 segundos. Duración de pared
41003.98 s, atravesando el cambio de día; no se atribuye por ello una causa única.
El caso aislado pasó en 6610.76 ms. Recorre miles de nodos con reloj de la sonda
fijo para probar el límite de cantidad; el cálculo CSS real de JSDOM no forma
parte de esa aserción.

Se simula sólo visibilidad en ese caso, conservando 4100 nodos y el límite
productivo. Dos casos adicionales usan estilos reales display:none y
visibility:hidden para verificar que campos ocultos no se clasifican como
visibles. Las 13 pruebas pasaron; el caso de presupuesto tardó 2750.79 ms.
ESLint dirigido pasó. No cambia código productivo del navegador ni timeout.
Se repite el gate completo en `gate-nov06.log` con código de salida propio.

Fixture estabilizado: `electron/__tests__/browser-sensitive-page.test.ts`, SHA-256 `57ca737691c520380a7ed5db4b92a20a61e7bb334907da1482b4d220a734a67e`.

Inventario productivo previo a la fase final: 2629 fuentes, SHA-256 agregado
`06220cdb48d1aa84a526abc40b7040ca615a9c40ea5b83d8156732d2da84ae5d`.
Se conserva la lista implícita de rutas Git existentes src TS/TSX y electron TS,
sin __tests__ ni declaraciones, con bytes y rutas separados por NUL en orden.

## Resultado definitivo local

`npm run verify:pr` del 6 de noviembre: código 0 (`gate-nov06.exit`).
590 archivos aprobados y 2 omitidos: 7056 pruebas aprobadas, 5 omitidas.
Cobertura de las 2629 fuentes productivas: líneas 60.47%, sentencias 58.99%,
funciones 55.41% y ramas 52.40%. Lint incremental: 726 archivos sin deuda nueva.
La huella productiva posterior coincide con la previa a la fase final.
La compilación aislada terminó en código 0 y no se cambió producción después.

Se conservaron ambos fallos anteriores y sus logs. La revisión propia no es
independiente: tarea 1.4 pendiente y cambio sin archivar. No se declara eliminada
la deuda global ni se deduce un nuevo porcentaje del número de pruebas.
