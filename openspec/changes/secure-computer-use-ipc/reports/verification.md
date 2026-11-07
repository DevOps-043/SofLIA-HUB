# Verificación del lote 42

Fecha: 2026-10-26. Implementación integrada y verificada localmente;
revisión independiente pendiente.

## Alcance y regresiones

Frontera completa de 33 herramientas computer y confirmación informativa:
schemas, fuente Hub/Orbe, marco/documento y revisión de sesión; snapshot acotado,
aprobación nativa del efecto y trabajos físicos acotados. Conserva servicio,
handler, allowlist, preload y wrappers. Añade capability declarativa que evita
doble diálogo local sin conceder permiso al renderer.

Cinco pruebas causales fallaron antes de modificar producto (ventana ajena,
argumentos extras, escritura sin HITL, publicación tras cambio de identidad y
concurrencia del emisor). Suite dirigida final: 226 aprobadas, cero fallos en
nueve archivos; 77 casos nuevos respecto de unidad 41. Las nueve pruebas de
confirmación preexistentes conservan su cantidad y verifican la nueva política:
confirmación informativa no concede permisos persistentes ni always.

Se usa dispatcher sustituido para negativas de autoridad/carreras, integración
wrapper/preload/allowlist/handler y pruebas existentes de herramientas con
puertos sustituidos. Las 33 fixtures comprueban conservación de parámetros y
opciones públicas. Sin GUI/shell, correo, cuentas o recursos reales del usuario.

## Verificación global final

La [compuerta](gate-summary.json) terminó con código 0 en sus 14 etapas:
6405 pruebas aprobadas, cinco omitidas, 62 pruebas de tooling y 33 de Python.
Incluye typecheck, lint incremental de 541 archivos y 834 documentos Markdown.
Los cinco casos omitidos no se cuentan como aprobados.

El [lint completo](lint-evidence.json) conserva deuda histórica (código 1):
1838 → 1827 errores totales, 1418 → 1407 en producción y any explícitos
1245 → 1234. Once errores eliminados, 31 avisos conservados, cero fatales y
ningún aumento por archivo/regla/severidad. Reglas y exclusiones intactas.

La [cobertura](coverage-evidence.json) incluye las 2583 fuentes de producción:

| Métrica | Unidad 41 | Unidad 42 |
| --- | ---: | ---: |
| Líneas | 57.77% | 57.90% |
| Sentencias | 56.43% | 56.55% |
| Funciones | 52.59% | 52.89% |
| Ramas | 50.41% | 50.48% |

Pisos conservados: 56/55/51/49, respectivamente. No se ocultan fuentes para
superarlos. El [build aislado](build-summary.json) pasó con 3554 fuentes copiadas
y verificadas y seis salidas. No empaquetó ni inició la aplicación.

[Inventario estable](source-evidence.json): 3574 fuentes sin cambios durante
las comprobaciones, SHA-256
`1e183542069c1b6b9243b1a0453f187311f89264a0c9ac31c0e9a4f94c85176a`.
Delta respecto de unidad 41: siete archivos existentes y seis nuevos. Respaldos
comprobados contra hashes anteriores; para la prueba renderer se recuperó la
copia exacta del build aislado previo, sin modificar el producto ni el índice.

[Regresiones](regression-summary.json), [logs](log-evidence.json) y
[comprobaciones finales](final-checks.json) permiten contrastar la evidencia.
No se deduce un nuevo índice global del número de pruebas o errores eliminados;
el último publicado tras unidad 37 es 40.88%.

## Revisión adversarial propia

Se intentó refutar autorización con otra ventana/subframe/documento, registro sin
ventanas, A/B/A, navegación/destrucción durante diálogo y progreso tardío. Se
comprobaron getters/prototipos/ciclos/cuota UTF-8, snapshot mutable, contratos
desconocidos, protocolos/credenciales URL, capacidad cruzada, confirmación
informativa anterior, cierre tardío de diálogo y plazas físicas pendientes.

Se corrigieron: modo type de organización y URL sin esquema para conservar
comportamiento; límite serializado de reglas/adjuntos para revisar destinos
completos; excepciones/códigos fijos y mayHaveApplied en fallos de efectos.
No se introducen supresiones ni cambios de reglas/exclusiones/dependencias.

Revisión independiente pendiente; la revisión propia no la sustituye. No archivar.

## Límites y reversión

No acredita autorización de desktop-agent, preferencias computer, WhatsApp o
HTTP interno. No cancela/atomiciza efectos ya admitidos ni modifica el backend
shell heredado de GUI. Ocultar publicación tras revocación no prueba ausencia de
efecto físico tardío; servicios internos necesitan propagación de cancelación y
revalidación por etapa. Un servicio pendiente conserva su plaza, sin cola.

El diálogo vencido se bloquea hasta cerrar físicamente; después del rechazo
lógico puede admitirse lectura nueva, pero no otro diálogo físico concurrente.
Contenidos largos muestran preview/digest y la contraseña SMTP no se muestra.
Errores de servicio dejan de reflejar detalle privado; no ofrecen diagnóstico
completo del proveedor al renderer. No hay permiso persistente desde confirm-action.

Respaldos relativos y logs en TEMP/soflia-computer-use-ipc-2026-10-26. Revertir sólo
delta de unidad 42, preservando índice y cambios ajenos. No hubo stage, commit,
push, despliegue, SQL remoto ni modificación de secretos/.env.
