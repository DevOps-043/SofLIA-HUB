# Verificación del lote 46

Fecha: 2026-10-27. Verificado localmente; revisión independiente pendiente.

## Resultado y regresiones

Cancelación entre etapas de BrowserWeb/UIA: decisiones, capturas y efectos
compuestos verifican vigencia. La señal llega al SDK y el rechazo por cancelación
no consulta otro modelo. Conserva entrada, clientes, modelos, DTO, HITL y colas.
Inicio/finalización protegidos por limpieza; una URL descartada no bloquea cola.
Listener anterior al evento inicial, vigente durante finalización y retirado al
terminar. Traza iniciada conserva cierre sin captura final adicional al cancelar.

Tres casos causales fallaron antes del cambio: acción web tras revocar y estado
ocupado ante consumidor inicial/finalizador fallidos. Después pasan. Se extiende
prueba con UIA, modelos reales del servicio con SDK sustituido, acciones compuestas
y preparación revocada. Todos usan modelos/páginas/entrada ficticios; sin GUI,
cuentas, claves o programas de escritorio reales.

## Revisión adversarial propia

Se intentó revocar al crear artefactos, publicar inicio/step, esperar visibilidad,
capturar, esperar modelo, ejecutar click/fill/select y antes del siguiente efecto.
Se intentó activar modelos/click/fill alternativos tras revocar y romper inicio,
finalización o lectura de URL durante limpieza. Casos legítimos conservan éxito
y fallback. Se mantiene contexto/reserva síncrona de las colas del lote 45.

La comprobación de tipos detectó Array.at fuera del target y un fixture UIA
incompleto: se corrigieron sin relajar TypeScript ni sustituir tipos por any.
La revisión detectó escritura de `$pid`, alias de la constante automática PID,
en el script previo de captura UIA. `Get-Variable PID` confirmó Constant/AllScope
sin ejecutar captura. Una prueba con exec sustituido falló antes de renombrar
la variable local a foregroundProcessId; no se ejecutó programa de escritorio.
La primera compuerta se interrumpió para esta reparación y su build previo no
se acepta para las fuentes finales. Sus logs quedan en attempt-first, con
motivo/PID propios en interrupted-first.json. La corrida final se ejecuta de nuevo.
Revisión independiente pendiente; la revisión propia no la sustituye. No archivar.

## Límites, estado y reversión

Una llamada ya iniciada puede completar efectos internos y no se revierte.
Creación de página/perfil, SDK remoto y SO conservan límites físicos; las guardas
no equivalen a arbitraje global de entrada ni aislamiento de perfiles/cachés.
Capturas/artefactos previos mantienen su política. Finalización no es una
transacción con publicación de resultados; la lease originaria main conserva
su comprobación final antes de entregar al llamador o guardar aprendizaje.

Respaldos/logs TEMP/soflia-backend-cancellation-2026-10-27 frente al lote 45;
reversión sólo del delta. Sin stage/commit/push, SQL remoto, despliegue, secretos
o .env. No se calcula porcentaje global desde cantidad de pruebas/any retirados.

## Comprobación final

La corrida final de npm run verify:pr aprobó sus 14 etapas: 6672 pruebas
aprobadas y 5 omitidas, 552 archivos aprobados y 2 omitidos.
Tooling 62 y Python 33; typecheck, arnés y lint incremental
(612 archivos) aprobados. 860 Markdown verificados en la compuerta.

Suite dirigida final: 198 aprobadas, cero fallos en 14 archivos,
44 casos nuevos. Tres fallos causales iniciales y una regresión
de la constante PID demostrados antes de sus correcciones; procesos nativos sustituidos.

ESLint completo conserva exit 1 por deuda histórica: 1806 → 1760
errores, producción 1396 → 1350, any 1223 → 1177.
31 advertencias, cero fatales y cero aumentos por archivo/regla/severidad.
Se retiran 46 incidencias sin reglas/supresiones/dependencias nuevas.

Cobertura de 2595 fuentes productivas: líneas 58.93%, sentencias
57.5%, funciones 53.74%, ramas 51.18%. Antes,
lote 45: 58.47/57.10/53.44/50.96. Pisos 56/55/51/49 intactos y sin exclusiones nuevas.

Build aislado final aprobado: 3582 fuentes coincidentes y seis salidas
no vacías, sin .env, instalador ni arranque. Fuentes estables antes/después:
3602 archivos; SHA-256 348c05bbedee297cd2c3fbb40b1d8bd1a935ba6aa4f03d9d181d3af923b98510. Delta frente al lote 45:
12 existentes respaldados y cinco nuevos. La eliminación ajena staged de
bulk-label-verification.ts se preserva ausente, sin restaurarla.

Recibos: [compuerta](gate-summary.json), [build](build-summary.json),
[cobertura](coverage-evidence.json), [lint](lint-evidence.json),
[regresiones](regression-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json). La corrida inicial interrumpida y su build previo
no se presentan como evidencia del estado final.
