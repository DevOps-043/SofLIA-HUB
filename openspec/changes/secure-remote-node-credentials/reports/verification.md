# Verificación del lote 40

Fecha: 2026-10-26. Implementación integrada y verificación local aprobada.

## Resultado implementado

Perfiles cifrados versionados por propietario exacto, con almacén/llavero
comunes y publicación atómica. El legado completo admitido se preserva cifrado;
sólo nodos propios válidos se importan, sin heredar host ni huérfanos. Host nuevo
apagado, aviso de migración y campos de contraseña para emparejamiento manual.

El servicio deriva identidad main, serializa mutaciones sobre copias y espera
guardar antes de publicar. Logout/A/B/A invalidan cargas, revisiones, transporte
y host. La caché, el borrador de token y las capturas del panel se retiran al
cambiar cuenta; respuestas/setters obsoletos y StrictMode no los restablecen.
Host revalida cuerpo/efectos/respuesta y señal de tarea; cierre revoca servicio
sin espera de importación dinámica. Se mantienen canales, capas y dependencias.

## Evidencia dirigida

Seis fallos causales previos: lectura sin sesión, A/B, revisión A/B/A,
configuración/registro publicados tras error de disco y éxito antes de guardar.
La suite dirigida final aprueba 234 casos en 16 archivos, sin fallos: 52 casos
nuevos, incluidos cuatro añadidos a la suite previa de binding.

Pruebas del almacén con filesystem temporal propio y AES-GCM de prueba:
aislamiento A/B, propietario falso, legado mixto preservado, archivo existente
vacío/corrupto, llavero/cifrado/reemplazo fallidos, cuotas, snapshot y cola tras
rename admitido. Integración de cuatro capas con servicio/almacén reales y
puertos HTTP/llavero sustituidos. No se leen secretos ni datos runtime reales.

## Revisión adversarial propia

Hipótesis refutadas mediante pruebas: una carga A tardía no reemplaza B; error
de metadata no publica salud no persistida; cifrado revocado no registra bajo
otra cuenta; renderer no fija propietario ajeno; cambiar estado de identidad
reinicia binding idéntico; revocación cierra conexiones, cuerpo pendiente y
tarea; rotar token invalida respuesta del token anterior. Se verifican bytes
reales/tiempo, bearer, ocho conexiones y rechazo de campos inesperados.

La revisión encontró y corrigió caché/borrador/captura sin revisión de identidad
en el panel, y evitó esperar una importación dinámica para revocar al salir.
El primer ensayo StrictMode usaba wrapper que no reproducía doble activación;
se corrigió a reactStrictMode:true y se exige observar las dos llamadas.
No se atribuyen errores de fixture como fallos causales del producto.

La primera compuerta se detuvo en lint incremental por dos avisos nuevos de
dependencias de hooks, aunque el build pasó. Se capturaron las funciones
estables usadas por los callbacks y se repitieron los nueve casos renderer y
el lint de ambos archivos con cero incidencias. Las fuentes y logs anteriores
se conservan con prefijo pre-hook-fix; la compuerta/build finales se repiten
sobre el delta corregido, sin ampliar baseline.

Revisión independiente pendiente; la propia no la sustituye. No se archiva.

## Verificación global final

Las 14 etapas de verify:pr pasaron: 6279 pruebas Vitest aprobadas y 5 omitidas,
62 del tooling y 33 Python. Lint incremental revisó 517 archivos. El análisis
global conserva deuda histórica: 1878 → 1876 errores, 31 avisos y cero fatales;
producción 1458 → 1456 errores y 1285 → 1283 mensajes any. La comparación por
archivo/regla/severidad contra unidad 39 no muestra aumentos.

Cobertura de las 2574 fuentes productivas: líneas 57.35 → 57.61%, sentencias
56.01 → 56.28%, funciones 52.24 → 52.51% y ramas 49.96 → 50.19%. Pisos y
exclusiones conservados. Build aislado aprobado con seis artefactos; no acredita
instalador, arranque o llavero nativo. Las 3560 fuentes del manifiesto conservaron
hashes idénticos durante compuerta/build; las 3540 fuentes copiadas coinciden
con el sandbox. Delta: 22 fuentes existentes y 10 nuevas; respaldos existentes
coinciden con unidad 39. Manifest, lock, reglas, helpers de cifrado/archivo y
política de cobertura sin cambios.

Durante el lote se observó trabajo externo en el índice Git: la eliminación
previa de bulk-label-verification.ts ya estaba staged y no se enumera para el
build actual. Se conservó ausente, sin restaurarla ni cambiar el índice. La
comparación de fuentes antes/después confirma que no alteró la fuente validada.

Recibos: [compuerta](gate-summary.json), [build](build-summary.json),
[cobertura](coverage-evidence.json), [lint](lint-evidence.json),
[regresiones](regression-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json). El último índice global publicado sigue en 40.88%
tras unidad 37: este lote cierra brechas reales de custodia/sesión, sin convertir
automáticamente ese alcance en un nuevo escalón de la rúbrica global.

## Límites y reversión

Integración productiva con os-cipher existente; este lote no acredita llavero
nativo ni GUI, sockets/cuentas/nodos reales. No protege de malware con la
autoridad del usuario del SO ni acredita membresía/RLS organizacional. Bearer
entrante conserva autoridad de emparejamiento; HITL local por petición y otras
APIs de Computer Use/Desktop Agent siguen pendientes. No sanea secretos
arbitrarios en resultados remotos ni revierte efectos ya enviados.

La cola del almacén ordena las operaciones de su instancia en este proceso;
no ofrece bloqueo de perfiles entre procesos independientes.

Rename admitido antes de revocación puede terminar bajo su propietario; cola
del almacén lo ordena antes de cargas posteriores, sin promesa de rollback
físico. El legado que excede cuota o es inválido se conserva sin sobreescribir.
Sin llavero no hay migración plana nueva ni host activo: volver a iniciar
sesión tras habilitar el llavero. Archivos cifrados requieren versión compatible;
no degradarlos a plano para revertir código.

Respaldos y logs: TEMP/soflia-remote-node-credentials-2026-10-26. Revertir sólo
el delta de código contra unidad 39; conservar trabajo previo. Sin cambios de
dependencias/secretos/.env, SQL, stage/commit/push ni despliegue.
