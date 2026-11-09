# Runtime Electron parcheado y barrera de regresión

Estado: dependencia, barrera, smokes, gate y build finales aprobados.
Revisión independiente pendiente antes de archivar. Fecha local: 2026-10-24.
Rama: codex/reduce-technical-debt. Se conservan las veintiuna unidades previas.

## Problema y cambio

Electron 44.5.1 estaba afectado por
[GHSA-jr5w-w6x2-84p9](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)
(CVE-2026-115570): falta la mitigación de certificados intermediarios
comprometidos en las conexiones de Chromium y Node. El mantenedor requiere
actualizar; no ofrece workaround en la aplicación. Se elige la versión estable
[44.9.3](https://releases.electronjs.org/release/v44.9.3), dentro de la misma rama
mayor y posterior al parche 44.9.1.

Se fijan manifiesto/lock/paquete/binario. El checker combina estabilidad y rangos
afectados del aviso usando semver con prereleases incluidas, sin comparador
casero ni excepción beta que omita seguridad. runtime:stable pasa a ser etapa
obligatoria en verify:pr y se conserva en release sin duplicarla. La política
del aviso se mantiene manualmente: no sustituye la auditoría de todo Electron.
API, canales, capas, perfiles y permisos runtime se conservan.

## Suministro e instalación

Se guardaron package/lock antes de cambiar. Resolución --package-lock-only
--ignore-scripts, revisión del diff y metadata npm; sólo cambia la versión e
integridad del paquete Electron. semver 7.8.5 ya estaba instalada; se declara
directamente en dev para evitar una transitiva implícita, licencia ISC y sin
hooks de instalación. Electron tiene licencia MIT; se revisó install.js, que
usa @electron/get con checksums y extracción nativa. No hay versiones nuevas
del resto del cierre ni paquetes retirados del lock.

Tras comprobar que el ejecutable anterior no estaba en uso y las rutas eran
del workspace/temporal autorizado, se movió el paquete anterior a
%TEMP%/soflia-electron-security-2026-10-24/electron-44.5.1 para recuperación
forense. Se instaló con --ignore-scripts y se ejecutó sólo install.js revisado
con entorno allowlisted, sin overrides de mirrors. El respaldo vulnerable no
se propone como runtime operativo de rollback.

runtime:stable acredita concordancia de las cuatro fuentes. Además se comprobó
SHA256 del ZIP cacheado frente a SHASUMS256 oficial de GitHub y el hash del
ejecutable instalado frente a la entrada electron.exe del ZIP validado. Ver
archive-validation/binary-validation. Hashes vinculan bytes a esas fuentes,
sin pretender verificar toda la cadena de suministro o la firma del instalador.

Auditoría comparable del día: 20 a 19 paquetes afectados, 12 a 11 high y ocho
moderate, sin afectados nuevos. omit=dev: 19/11 high/ocho moderate antes y
después. npm clasifica Electron como dev aunque se distribuya su runtime: no
interpretar la auditoría omit=dev como inventario completo de la app. Persisten
otros avisos; cifras de paquetes afectados no equivalen a CVE independientes.

## Matriz y evidencia

| Garantía | Evidencia |
| --- | --- |
| Rangos afectados/metadata inválida rechazados y parches admitidos | check-electron-stability.test.mjs: límites 42/43/44/45 |
| Excepción beta no suprime aviso | candidato beta.5 rechazado; beta.6 con excepción válida admitido |
| Versión antigua real rechazada por CLI | runtime-old-rejected.log: exit 1 con 44.5.1 antes de instalar |
| Lock/paquete/binario divergentes rechazados | tres checkouts ficticios con CLI real; el ejecutable Node devuelve versión Electron ausente |
| Pin y ejecutable reales alineados | runtime-final.log y comparación de ZIP/binario |
| Navegador con Electron nuevo real | once fases, 117 comprobaciones sin limitaciones |
| Privacidad/custodia por usuario en DPAPI | tres procesos de calendar:smoke:native: write/read/disconnect, incluye Gmail y Project Hub |
| Preload sandbox e IPC de voz/documentos | doce y once comprobaciones, servicios/diálogos simulados |

Cinco casos nuevos nombrados del checker pasan; la prueba roja inicial produjo
cuatro fallos por guardas aún ausentes. El rechazo CLI del runtime antiguo fue
observado antes de instalar. Los fixtures de divergencia usan procesos Node
reales en temporales con una junction sólo a semver; no reemplazan Electron del
workspace ni ejecutan el runtime vulnerable. La evidencia se conserva sin borrar
la junction. Nueve casos iniciales de checker/wiring y 80 casos Vitest de zoom y
build pasaron; el filtro Vitest seleccionó dos archivos existentes, sin contar
un tercer nombre que no existía como cobertura. Lint enfocado pasó.

El smoke de navegador final pasó exercise/restore/lifecycle/vault/autosave,
zoom-startup/zoom/safety/passkeys/extensions/policies, con Electron 44.9.3 y
Chromium 152.0.7977.167. Incluye certificado autofirmado local rechazado sin
bypass TLS, persistencia/DPAPI, sandbox, navegación, descargas, capturas/input,
PDF y aislamiento. Perfiles ficticios y proveedores locales/controlados;
no reproduce el certificado comprometido real ni acredita MITM o cuentas.

## Hallazgos y autorrevisión adversarial

El primer browser smoke falló en zoom: el fixture exigía getZoomFactor=1 aunque
el módulo del producto ya usaba setZoomMode aislado de Electron 44. Se exige
ahora API nativa/factor aplicado y se conserva el factor uno de la pestaña
vecina. La siguiente ejecución detectó que el borde del botón UA reducía el
rectángulo rojo (275 frente a 280 esperado): el fixture fija border/padding=0
para medir su caja de 100x40. No se amplían tolerancias ni se eliminan pruebas
de bitmap, viewport, coordenadas, independencia o doble zoom. La fase dirigida
pasó quince comprobaciones y después pasaron las once fases completas. No se
modificó el zoom del producto para acomodar la prueba.

Se intentó refutar regresión a estable vulnerable, bypass por excepción beta,
aceptación de metadata/lock sin binario actualizado, instalación con bytes
distintos y falso verde por una sola fase. Se mantienen tiempos/errores del
checker y aislamiento de cada smoke. La incorporación del parche se acredita
por versión y bytes oficiales; el caso TLS local sólo prueba rechazo genérico
de certificado inválido. Esta es autorrevisión, sin revisión independiente.

No hubo commit, push, dispatch, release, SQL, credenciales/cuentas reales,
micrófono/modelos, lectura de .env o cambios al store del SO. Instalar en este
checkout no actualiza despliegues existentes. Faltan certificación de otros SO,
instalador, proveedores/cuentas reales y revisión independiente; Intel Python
sigue pendiente en su unidad. No se recalcula el índice de deuda global.

Recuperación: elegir otro runtime parcheado con sus hashes y verificarlo;
mantener coherentes pin/lock/binario y política. Conservar separadas las otras
unidades; no retirar la barrera ni reactivar 44.5.1 para conseguir un verde.
Logs locales: %TEMP%/soflia-electron-security-2026-10-24.

## Verificación final

La compuerta completó sus trece etapas con exit 0: 5690 casos Vitest aprobados
y cinco omitidos; 498 archivos aprobados y dos omitidos (500 total), 191.55 s.
Además 22 pruebas del tooling y 33 contratos Python con standalone 3.12.11.
Lint incremental revisó 302 archivos sin deuda nueva y comprobó enlaces de 710
Markdown activos. Ver gate-summary.json. Estas cifras describen el worktree
acumulado; los casos nuevos del checker están en el gate Node, no se suman como
casos Vitest adicionales. Node local 26.7.0, CI configurado con Node 24.

Build JInnT3 aprobado: 3443 fuentes copiadas y seis artefactos no vacíos;
seis fuentes relevantes del sandbox coinciden con el worktree por SHA256.
Las 3461 fuentes registradas de build/Python/workflows y su inventario completo
permanecieron iguales durante ambas comprobaciones. Ver build-summary y
source-evidence JSON. No es evidencia de empaquetado, firma o arranque completo.
