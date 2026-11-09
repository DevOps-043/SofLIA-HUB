# Verificación del lote 44

Fecha: 2026-10-27. Implementación integrada y verificada localmente;
revisión independiente pendiente.

## Alcance y pruebas dirigidas

Registro común de los 23 canales Desktop Agent, schemas por tupla y fuente
Hub/Orbe con revisión de identidad. HITL nativo para efectos; consultas/controles
usan cupos independientes, sin impedir abort/stop durante tarea. Startup entrega
ventanas y preload declara revisión nativa conservando cuatro capas/canales.
Signals sólo main llegan a tareas/paralelos y lease retenida de observación.

Teclado usa tokens antes de driver/PowerShell y datos argv sin opciones del
usuario. Observación revalida tras captura/modelo/evento y no deja finally viejo
mutar generación nueva; ciclo físico pendiente conserva exclusión. Config se
valida/carga por campo y se persiste con reemplazo antes de publicar estado.

Ocho regresiones causales fallaban antes de modificar producto: fuente ajena,
coordenadas inválidas, escritura sin HITL, lectura sin sesión, respuesta A/B/A,
fragmento de teclado, acción de observación después de stop y publicación antes
de guardar. Suite dirigida: 252 aprobadas, cero fallos en 13 archivos; 128 casos
nuevos respecto de unidad 43. Se conservan cantidades de casos preexistentes;
la prueba que antes esperaba silenciar fallo de guardado ahora exige rechazo.

Contratos felices/extra de los 23 canales, origen rechazado por cada canal,
cuatro capas con wrapper/preload/allowlist/handler reales, tarea/observación con
puertos sustituidos y filesystem temporal propio. Sin GUI, modelos/cuentas,
entrada real al SO o configuración real del usuario.

## Verificación global final

La [compuerta de PR](gate-summary.json) terminó con código 0 en sus 14 etapas:
6602 pruebas aprobadas y cinco omitidas, 62 pruebas de tooling y 33 de Python.
Incluye typecheck, lint incremental de 582 archivos y 848 documentos Markdown.
Los cinco casos omitidos no se cuentan como aprobados.

El [lint completo](lint-evidence.json) conserva deuda histórica (código 1):
1823 → 1811 errores totales, 1403 → 1401 en producción y any explícitos
1230 → 1228. Doce errores menos (dos en producción y diez en pruebas), 31 avisos
conservados, cero fatales y ningún aumento por archivo/regla/severidad. No se
relajan reglas, exclusiones o umbrales.

La [cobertura](coverage-evidence.json) incluye las 2593 fuentes productivas:

| Métrica | Unidad 43 | Unidad 44 |
| --- | ---: | ---: |
| Líneas | 58.11% | 58.35% |
| Sentencias | 56.77% | 57.00% |
| Funciones | 53.03% | 53.28% |
| Ramas | 50.70% | 50.85% |

Pisos conservados: 56/55/51/49, respectivamente. Persisten 996 archivos sin
cobertura de sentencias; superar pisos no cierra toda la deuda de pruebas.

[Build aislado](build-summary.json) con código 0, 3574 fuentes copiadas y
contrastadas y seis salidas. No empaquetó ni inició la aplicación.
[Inventario estable](source-evidence.json): 3594 fuentes sin cambios durante la
verificación, SHA-256
`18d19df06ca5926361a975addd5087b50e8336706a385b2ff9d68609208d0734`.
Delta frente a unidad 43: 24 archivos existentes y ocho nuevos; los respaldos
previos coinciden con sus hashes. Dependencias, política y modelo conservados.

[Regresiones](regression-summary.json), [logs](log-evidence.json),
[restauración de prueba](test-restoration.json) y
[comprobaciones finales](final-checks.json) conservan evidencia contrastable.
No se deduce un porcentaje global desde número de pruebas o errores. El último
índice publicado tras unidad 37 es 40.88%; no representa una reevaluación del lote 44.

## Revisión adversarial propia

Hipótesis: otra ventana/subframe/documento, falta de sesión/getters/ciclos/cuota,
mutación del snapshot durante diálogo, A/B/A/destrucción/navegación, control
bloqueado por tarea pendiente, resultados privados, efectos viejos tras stop,
ciclos reemplazados pero físicamente vivos, código en teclas y éxito parcial de
guardado. Las pruebas existentes del servicio amplían contratos de filesystem
simulado para stat/rename/unlink; no se debilitan los checks para ocultar fallos.

Correcciones adicionales: señal/timeout al SDK de observación, revalidar después
de emitir observation-action, sanear excepciones individuales de paralelo y
liberar lease del handler al abort global. Clipboard sólo restaura si conserva
el texto escrito. Campos de config cubren exactamente el DTO/defaults.

Una prueba negativa detectó que aún estaba activo el fallback cwd y creó
desktop-agent-config.json. Se comprobó que era nuevo/no versionado y ausente del
estado inicial, se preservó copia temporal y se retiró sólo ese archivo generado;
se corrigió getConfigPath y la misma prueba pasó exigiendo cero escrituras.
No se modificó configuración preexistente ni índice. Recibo de restauración en
TEMP/soflia-desktop-agent-ipc-2026-10-26/test-restoration.json.

Revisión independiente pendiente; la propia no la sustituye. No archivar.

## Límites y reversión

Autorización de lectura no prueba ownership de todo el estado histórico del
servicio. Eventos, memoria, caches/perfiles y otros productores runtime conservan
deuda de aislamiento propia. El control global pertenece al usuario/servicio,
sin ownership por ventana. No certifica todos los drivers ni su arbitraje con
otros procesos del equipo. Outcome/datos del dominio no son redacción general.

Señal/stop no revierten efectos ya enviados ni cancelan uniformemente SDK/backends
internos. El ciclo físico de observación puede retener plaza hasta retorno del
proveedor; timeout de SDK no acredita cancelar trabajo/coste del servidor.
Config atómica no acredita fsync/locks entre procesos. Teclas OEM dependen de la
distribución. No se ejecutó calibración, mouse/teclado ni preview real.

Reversión sólo delta de unidad 44 respaldado en TEMP frente a hashes de unidad 43.
Sin cambios de dependencias, reglas, exclusiones, secretos/.env, stage/commit/push,
SQL remoto o despliegue. Índice y borrado ajenos preservados.
