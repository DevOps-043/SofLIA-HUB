# Verificación del lote 48

Fecha: 2026-10-30. Implementado y verificado localmente; revisión independiente pendiente.

## Alcance y causa

Diez canales aceptaban actor del renderer sin fuente/sesión. Dos casos causales
fallaron antes del arreglo: actor ajeno y ventana ajena alcanzaban el servicio.
Se derivan usuario/organización en main, se conservan hints coincidentes y se
exigen schemas cerrados, principal SOFIA activo y aprobaciones nativas.

Las cuatro capas usan el mismo DTO; no cambian canales, modelos o dependencias.
Los puertos del servicio son explícitos. El callback de startup consulta las
ventanas Hub/Orbe reales al invocar, sin capturar una ventana inicial obsoleta.

## Pruebas y revisión propia

Suite dirigida ampliada: 169 aprobadas en once archivos; 93 casos nuevos frente
al lote 47 (90 en Communication Hub y tres en enums OpenAI). Typecheck cero.
ESLint completo: 1730 errores frente a 1759, 31 avisos, cero incrementos por
archivo/regla/severidad. Los 29 errores retirados son any productivos; la salida
global sigue 1 por deuda histórica, sin alterar reglas o exclusiones.

Casos: diez contratos con servicio y cuatro capas reales; puertos de SOFIA,
persistencia, diálogos y transportes ficticios. Actor/fuente/subframe, sesión y
organización A/B/A, rol cambiado después de aprobar, clave oculta, aridad,
schemas, getter/ciclo, límites de JSON, cuota física y señal deadline. WhatsApp
y Telegram conservan sus métodos existentes; no hay mensajería ni SQL reales.

La revisión encontró y corrigió: scope personal usado hacia grupos sin su
capacidad; auditoría personal antigua marcada como organización; llamada
confirmada con rol ya revocado; posible re-vinculación de chat ajeno; e herencia
del contexto temporal en polling permanente. Este último caso prueba que un
callback iniciado por conexión sigue operando después de cerrar el IPC.

La primera compuerta se interrumpió por un hallazgo adicional antes de aceptar
su evidencia: enums con String(array) aceptaban arrays y podían eludir la guarda
de grupos. enum-red.json contiene tres rojos/82 verdes con el servicio real;
openai-enum-red.json reproduce el mismo defecto en tres casos del contrato
OpenAI (20 verdes). Se exige string real en bounded-json y se reutiliza en ambos
contratos. Los logs/fuentes anteriores quedan bajo attempt-first y el motivo en
interrupted-first.json. El build anterior terminó cero pero no acredita las
fuentes corregidas: ambos se repitieron sobre las fuentes finales.

## Resultado final

verify:pr terminó cero en sus 14 etapas: 6839 pruebas aprobadas y cinco omitidas,
563 archivos aprobados y dos omitidos, 62 pruebas tooling y 33 Python. Suite
dirigida final: 169 aprobadas en once archivos, 93 casos nuevos frente al lote 47.
Typecheck, arnés, integridad CI, runtime estable, documentación y lint incremental
aprobaron. El build aislado final terminó cero en 75.77 segundos.

| Métrica | Lote 47 | Lote 48 |
| --- | ---: | ---: |
| Errores ESLint globales | 1759 | 1730 |
| Errores en TS productivo | 1349 | 1320 |
| Mensajes any en TS productivo | 1176 | 1147 |
| Cobertura de líneas | 59.14% | 59.43% |
| Cobertura de sentencias | 57.72% | 58.02% |
| Cobertura de funciones | 53.93% | 54.32% |
| Cobertura de ramas | 51.47% | 51.77% |

ESLint completo mantiene salida 1 por deuda histórica, 31 avisos, cero fatales
y ningún incremento por archivo/regla/severidad. V8 incluye 2610 fuentes
productivas, también las no importadas. Dependencias, reglas, pisos, exclusiones
y selección de modelos se conservan; no se agregaron canales.

3628 fuentes verificadas antes/después sin cambios: SHA-256 del inventario
eb7bffe2356f508d1808007f8b6ab3d136bce06211e0233eb81d82aa50a167e6.
Delta del lote: 16 fuentes, seis nuevas y diez existentes; cada respaldo
existente coincide con el hash anterior. El sandbox pulse-app-build-vu8ZJ0
contiene las 3608 fuentes compilables exactas y seis salidas no vacías. No
copió .env ni arrancó/empaquetó la aplicación. Los avisos históricos de chunks
grandes persisten. La eliminación ajena staged permanece ausente, sin restaurar.

Recibos: [compuerta](gate-summary.json), [regresiones](regression-summary.json),
[lint](lint-evidence.json), [cobertura](coverage-evidence.json),
[build](build-summary.json), [fuentes](source-evidence.json) y [logs](log-evidence.json).

Los transportes/singletons se inician fuera de AsyncLocalStorage temporal,
pero el servicio revalida el contexto al retomar cada espera. Las consultas
SOFIA reciben su señal. Se retiene la plaza hasta resolver el I/O real si ignora
cancelación. No hay reintento automático de efectos cuya respuesta se pierde.

Revisión independiente pendiente; la revisión propia no la sustituye. No archivar.

## Límites y reversión

Otras APIs directas de WhatsApp/Telegram, conexiones y estado físicos globales
no quedan aislados íntegramente. Historial físico sin ownership acreditado no
se publica por esta vía; estado operativo sólo contiene booleanos. Eventos
históricos sin alcance probado se restringen a su actor. No se acredita RLS,
proveedor, cuenta, plataforma o GUI reales.

Respaldos/hash/logs: TEMP/soflia-communication-ipc-2026-10-30 contra lote 47.
Revertir sólo el delta; preservar índice/trabajo ajenos y la eliminación staged
de bulk-label-verification.ts. Sin stage/commit/push, SQL, despliegue, secretos
o cambios reales de configuración durante QA. No se infiere porcentaje global
desde pruebas/lint; el 40.88% publicado tras lote 37 conserva carácter histórico.
