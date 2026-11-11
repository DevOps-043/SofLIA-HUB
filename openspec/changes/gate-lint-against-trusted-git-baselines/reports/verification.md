# Barrera incremental con bases Git verificadas

Estado: implementación y verificación final aprobadas; revisión independiente pendiente.
Fecha: 2026-10-24. Unidad 26 acumulativa, rama codex/reduce-technical-debt.

## Problema reproducido y alcance

La implementación anterior aceptó un commit TS con una variable sin usar al
comparar su contenido con el mismo HEAD y omitió un mjs nuevo por su extensión.
Ambos terminaron con exit 0 en un repositorio temporal propio. La primera suite
CLI reprodujo 13 fallos y cinco aprobaciones contra esa implementación. Durante
revisión se reprodujo otro falso verde: una configuración anidada vacía anulaba
reglas. No se deduce una cantidad de deuda del número de estas regresiones.

Se separa selección/lectura Git del análisis ESLint; se resuelven commits, se
compara con un único merge-base para cambios comprometidos y con HEAD para
cambios locales. Se exigen todas las bases aplicables, sin presupuesto adicional
por mejoras ya comprometidas. La lectura de blobs distingue ausencia de archivo
y fallo Git. El parser fatal o un resultado incompleto nunca son baseline vacío.

El selector incluye ocho extensiones TS/JS y rutas NUL literales. Usa la
configuración canónica de raíz y rechaza enlaces de fuentes, sin seguirlos hacia
otro directorio. Conserva exclusiones y presupuestos por regla/severidad. Los
contextos Node ESM/CommonJS y browser se declaran por área; sólo el fixture
project-panel existente recibe sus dos globals DOM. No se amplía el baseline.

El diagnóstico inicial identificó 48 candidatos adicionales JS/variantes. Dos
ternarios de helpers propios se sustituyeron por if/else con la misma salida y
limpieza. El smoke IPC necesitaba también management-request y su contrato
compartido: se completa su copia aislada, sin cambiar funcionalidad Project Hub,
canales, SQL ni aserciones. No se modifica código funcional del producto.

## Pruebas dirigidas y correcciones del arnés

`node --test --test-concurrency=1 scripts/quality/lint-changed.test.mjs
scripts/quality/lint-baseline.test.mjs` aprobó 26 casos: 21 CLI Git/ESLint reales
y cinco del presupuesto/configuración. Comprueba ocho extensiones, commit,
ambas bases, merge-base con rama avanzada, referencia inválida/sin ancestro,
historia shallow, primer commit, deuda histórica, parser fatal, índice y borrado,
exclusiones, Unicode/espacios/corchetes, configuración anidada y enlaces.

Los repositorios/commits son fixtures temporales propios: hooks y firma se
desactivan por comando; el workspace no se agrega ni compromete. Se usa archivo
Git global vacío regular, porque os.devNull en Windows hizo fallar Git. El caso
de rama huérfana crea un árbol distinto y exige SHA distinto: dos commits raíz
idénticos podían compartir SHA. El positivo de global local usa const para no
provocar legítimamente no-unassigned-vars.

Una ejecución concurrente tuvo un timeout de 45 s al importar ESLint en el
primer proceso CLI; el otro archivo tardó 42.9 s en su primer análisis. No
demuestra fallo funcional ni permite atribuir causa al SO. La repetición por
archivo en serie aprobó todos los casos en 44.19 s, con el mismo timeout. Se
acota así la concurrencia de test:quality; no se suprimen pruebas ni errores.

`npm run project-hub:smoke:native` aprobó 10 comprobaciones en Electron real
después de completar las fuentes del arnés. `npm run select:smoke:native` con
Electron local aprobó seis, incluidas teclado/AX/zoom/reduced motion. Datos,
servicio y diálogos Project Hub son ficticios; no hay cuentas o mutaciones
remotas. El selector usa un build aislado y perfil temporal. No acredita todo
el contrato nuevo de gestión Project Hub ni una plataforma distinta de Windows.

## Autorrevisión adversarial y límites

Se intentó refutar: comparar un commit consigo mismo, omitir JS, usar una rama
base avanzada en lugar de merge-base, reintroducir deuda después de reducirla,
aceptar una referencia inválida, ocultar parser fatal, interpretar nombres como
globs, seguir junctions y eludir reglas mediante configuración anidada. La última
hipótesis encontró el falso verde corregido antes del cierre. También se redujo
un contexto browser inicialmente demasiado amplio, que colisionaba con globals
locales legítimos de fixtures Node; no se renombró código ajeno para pasarlo.

El comando certifica contenido actual del worktree. El índice sólo selecciona
rutas; un índice distinto necesita verificación tras commit/CI. Renombres sin
fuente en la base se consideran nuevos. No detecta redistribución de incidencias
dentro de una misma regla/severidad histórica. La configuración vigente aplica
a ambas fuentes; cambiar el gate o sus reglas requiere revisión humana y esto
no se presenta como defensa contra un autor que reescriba la compuerta entera.
La comprobación de enlaces no constituye aislamiento frente a un escritor local
que sustituya rutas concurrentemente. CI remoto y Node 24 no ejecutados aquí.

No hubo secretos, .env, SQL, cambios de permisos, datos reales, commit del
workspace, push o despliegue. Se conservan las 25 unidades previas y los cambios
ajenos. IRIS sigue necesitando contrato backend verificado. El usuario confirmó
que no dispone de macOS Intel; su artefacto Python seguro sigue pendiente sin
rebajar cryptography. No se recalcula el índice global histórico de 50.375%.

Recuperación: reemplazar selectivamente el tooling por una solución que conserve
estas regresiones y actualizar su documentación; no restaurar el falso verde ni
deshacer otras unidades. Revisión independiente pendiente antes de archivar.

## Verificación final

`npm run verify:pr` aprobó las trece etapas con exit 0 en 398.47 s. Vitest
aprobó 5747 casos y omitió cinco, con 503 archivos aprobados y dos omitidos
(505 total); su duración fue 224.14 s. No hubo omisiones adicionales. Las
pruebas del tooling pasan de 25 a 48 y los contratos Python stdlib conservan
33 aprobaciones con standalone 3.12.11. Tipos, harness, OpenSpec, suministro,
política Electron, documentación y lint aprobaron: 361 fuentes revisadas sin
deuda nueva, 682 archivos en el inventario de pruebas y 733 Markdown activos.
Estos contadores no representan cobertura ni un porcentaje de deuda.
[Recibo de compuerta](gate-summary.json).

`npm run app:smoke:build` aprobó en 123.38 s con seis artefactos no vacíos.
Las 3482 fuentes de build/Python/workflows/configuración ESLint mantuvieron
idéntico SHA256 antes y después de ambas ejecuciones. Se verificaron además
los hashes de todas las 3462 fuentes existentes copiadas al sandbox BzOquZ.
El contador sourceFiles del arnés enumera 3463 rutas Git: incluye una fuente
ya eliminada localmente, electron/wa-agent/bulk-label-verification.ts, que la
copia omite explícitamente por ENOENT. Se verificó su ausencia también en el
sandbox y se distingue enumeración de copia efectiva en el recibo. No se restaura
ese archivo ajeno ni se presenta como compilado. El primer recolector de
evidencia asumía que ambas cantidades coincidían; se corrigió para comprobar
la diferencia exacta y conservarla, sin alterar código o resultados del build.
[Build](build-summary.json), [fuentes](source-evidence.json).

[Pruebas nativas](native-summary.json) conserva los dos perfiles y sus 16
comprobaciones. [Baseline](baseline-evidence.json) registra las reproducciones;
[logs](log-evidence.json) guarda rutas temporales y hashes, incluidos los fallos
previos y el éxito final. Node local 26.7.0 y Electron 44.9.3 Windows/x64;
no se ejecutó CI remoto ni se acredita instalador, arranque completo o cuentas.
Persisten avisos del bundler/localStorage y no se modificaron sus umbrales.

Después del gate sólo se completaron evidencia, tareas y documentación: la
guía de arquitectura remitía a una secuencia antigua de diez etapas y comparación
siempre contra HEAD; ahora remite a operación/estándar canónicos. Se aclara
también JS en la guía de portabilidad. Estas modificaciones se revalidan con
docs:check, docs:system:check, harness:validate y OpenSpec estricto. La unidad
permanece sin archivar hasta revisión independiente.
