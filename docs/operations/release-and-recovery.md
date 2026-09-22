# Release, respaldo y recuperacion

Estado: vigente. Actualizado: 2026-09-05.

<!-- evidence: electron-builder.json5 -->
<!-- evidence: .github/workflows/release.yml -->
<!-- evidence: electron/updater/constants.ts -->

## Artefactos por plataforma

| Plataforma | Target | Nombre |
|---|---|---|
| Windows x64 | Entrada visual propia; NSIS como motor silencioso por usuario | `Pulse-Hub-Windows-<version>-Install.exe`; actualizador: `Setup.exe` + blockmap/latest.yml |
| macOS | DMG | `Pulse-Hub-Mac-<version>-Installer.dmg` + latest-mac.yml |
| Linux x64 | AppImage y DEB | `Pulse-Hub-Linux-<version>-x64.<ext>` + latest-linux.yml |

NSIS conserva `userData` al desinstalar (`deleteAppDataOnUninstall: false`), crea
shortcuts y permite elevacion/directorio. Linux DEB depende de `libportaudio2`.

## Contenido empaquetado

- `dist/` y `dist-electron/` dentro de ASAR.
- `onnxruntime-node` desempaquetado de ASAR.
- runtime Python y dos sidecars como recursos.
- Context Pack meetings v1 como recurso, separado de skills de desarrollo.
- `afterPack` valida Python empaquetado.

## Preparar y comprobar el instalador Windows

```powershell
npm run python:setup
node scripts/quality/smoke-python-sidecars.mjs
npm run installer:smoke:win
```

El preparador usa CPython standalone 3.12.11, release Astral 20250612, con
SHA256 oficial fijado por plataforma en `scripts/python-runtime-support.cjs`.
Una fuente alternativa exige HTTPS y hash explícito. Es una versión fijada,
no una afirmación de que sea el parche más reciente ni una auditoría de CVE.
Las dependencias directas están fijadas; las transitivas de pip aún no tienen
un lock completo con hashes. Revisarlas antes de una distribución pública.

La preparación se hace en `tmp/python-runtime-build-*` y valida `pip check`,
versión e imports de voz, reuniones y documentos antes de escribir el lock y
promover a `python-runtime/`. La copia anterior queda en `previous-runtime`
dentro del staging. Si falla la promoción se intenta restaurarla; los temporales
y respaldos no se borran automáticamente. `--force` vuelve a preparar sin borrar
la copia anterior. El lock exclusivo `tmp/python-runtime-setup.lock` evita dos
preparaciones simultáneas; después de una interrupción, comprobar que no queda
un preparador activo antes de retirarlo. Una caché coincidente se vuelve a
validar con imports y `pip check`, no sólo por presencia de `python.exe`.

Python y pip se ejecutan aislados de `PYTHONPATH`, user-site y configuración
pip del usuario. No se modifica Python del sistema ni el PATH. Las herramientas
inicializan NumPy en el hilo principal de Windows antes de emitir `ready`: la
primera lectura de Excel podía bloquear su importación nativa desde un worker.
El trabajo de documentos sigue ejecutándose fuera del lector de comandos.

El smoke Windows crea un temporal con fuentes sin `.env`, una **copia física**
de las dependencias y una copia validada del runtime. La junction usada por el
smoke de compilación no sirve aquí: npm puede considerarla un árbol externo y
electron-builder omitir transitivas. Se verifica `npm ls`, los recursos de ambos
sidecars, el ASAR y el EXE con SHA256. `installer-report.json` conserva la fase
y resultado. No inicia el instalador ni Pulse Hub; no firma ni publica. Es un
artefacto de prueba sin configuración de cuentas, no un release para usuarios.

La entrada manual es ahora `Install.exe`, una ventana WPF sin marco NSIS, con
el logo original `public/assets/Icono.png`. [El generador](../../scripts/build-installer-shell.mjs)
embebe el motor `Setup.exe` y verifica su SHA-256 antes de ejecutarlo tras el clic
Instalar. **No renombrar Install.exe a Setup.exe ni sustituir latest.yml**:
el actualizador conserva su artefacto original. El shell tampoco firma ni publica.
`npm run build:win` construye ambos; el smoke hace lo mismo sin configuraciones locales.

La escena importa directamente [OrbCanvas](../../src/components/orb/OrbCanvas.tsx),
la geometría y los shaders de SofLIA: no es una reproducción WPF. Permite arrastre
con inercia, flechas, doble clic/Inicio/Enter para centrar y pausa de movimiento.
La web local no recibe herramientas ni acceso al motor; no solicita micrófono.
WebView2 usa perfil temporal privado, permisos denegados, navegación externa y
descargas bloqueadas, CSP restrictiva y mensajes de estado únicamente hacia la orbe.
El SDK Microsoft 1.0.4191.47 se descarga en build con hash fijado, se cachea con
reverificación y se embebe junto con su licencia. La orbe requiere WebView2
Evergreen instalado y WebGL; si faltan muestra aviso sin inventar otra orbe.
La ventana/motor requieren .NET Framework 4.8. No se instala WebView2 automáticamente.
Los temporales `PulseHub-orb-*` conservan recursos/licencias y perfil gráfico de
la vista; no contienen un perfil del navegador del usuario. Se cierran los
controles WebView al salir, pero no se borra recursivamente su perfil en uso.

El progreso de preparación mide bytes; la fase NSIS es indeterminada porque no
expone un porcentaje global. No se mata el motor durante escritura. El destino
debe ser local, sin enlaces y dedicado al producto. Pulse Hub abierto provoca
rechazo, no cierre forzado, cuando se usa la nueva entrada. Abrir al finalizar
requiere otro clic. Se conservan Python privado y datos del usuario.

`npm run installer:preview` genera una previsualización **sin motor** con estados
de demostración identificados; `npm run installer:test:native` compila y ejecuta
pruebas del servicio con un motor inocuo que no instala. La previsualización
NSIS anterior queda sólo como diagnóstico del motor de compatibilidad, no como
el diseño visible de la nueva entrada.

Antes de publicar: configurar el build autorizado, firma Authenticode y probar
instalación, actualización, cancelación, desinstalación, DPI/accesibilidad y
arranque con cuentas de prueba en Windows. La comprobación del paquete no
sustituye esa aceptación ni garantiza ausencia de avisos SmartScreen.

## Publicacion y update

GitHub Actions crea un release por version de `package.json` y extrae notas de
`CHANGELOG.md`. `electron-updater` consulta el repo de releases cada cuatro horas;
descarga/progreso/instalacion se exponen a UI. Instalar reinicia la aplicacion, por
lo que el usuario debe poder concluir trabajo activo.

La salida normal y la instalación explícita comparten una barrera main para el
guardado de sesión del navegador. Ante error o más de cinco segundos de espera,
el diálogo nativo ofrece reintentar, cancelar salida (default) o salir sin
guardar. Cancelar no destruye las vistas ni detiene anticipadamente los
servicios controlados por el lifecycle. Reintentar un timeout espera la misma
E/S; una respuesta tardía después de cancelar no autoriza el cierre.

El instalador no se invoca hasta superar esa barrera, exige actualización
descargada y agrupa solicitudes duplicadas. Su IPC acepta sólo la ventana
principal y su frame principal. La respuesta exitosa significa solicitud
aceptada, no instalación concluida: fallos posteriores se comunican por los
eventos del actualizador. El renderer muestra los errores y cancelaciones.

La barrera no cubre cierre forzado del proceso, apagado/reinicio o logout de
Windows, ni promete vaciar todos los stores de la aplicación. Electron no emite
estos eventos de cierre normal en esas rutas del sistema, según su
[contrato de lifecycle](https://www.electronjs.org/docs/latest/api/app#event-before-quit).
La sesión restaurable permanece detrás de su flag; no se activa como efecto de
esta protección. Hay smoke focalizado Windows del binario estable; siguen
pendientes el flujo completo de la aplicación y el instalador real.

## Diagnóstico local del navegador

En las herramientas del navegador, abrir **Soporte** y elegir **Exportar
diagnóstico JSON**. Confirmar el alcance y elegir un archivo nuevo. Cancelar no
crea un archivo; los destinos existentes se rechazan aunque el selector permita
elegirlos. La aplicación no manda el reporte a soporte automáticamente.

El JSON v1 contiene versiones, periodo y métricas instantáneas con fuente, sin
URLs, títulos, identificadores, nombres de descargas o contenido. No es respaldo
del perfil ni historial de incidentes: las descargas representan sólo los hasta
200 registros retenidos en la sesión. Se invalida al cambiar cuenta/ventana o
pasados cinco minutos; los errores no muestran rutas. Actualizar diagnóstico
permite reintentar un fallo de consulta sin reabrir el panel.

Se publica mediante un enlace exclusivo desde un temporal completo en la misma
carpeta. Requiere un filesystem que soporte ese mecanismo, comprobado en la
carpeta temporal local de Windows; ante un destino incompatible falla sin
sobrescribir. No hay fallback de escritura parcial ni garantía ante corte
eléctrico. Un fallo al retirar el temporal saneado emite un aviso local sin ruta;
no elimina el archivo exportado. La selección explícita de una carpeta
sincronizada queda sujeta al proveedor de esa carpeta.

## Smoke nativo aislado del navegador (Windows)

Antes de empaquetar puede ejecutarse `npm run app:smoke:build`. Copia las fuentes
del build registradas en Git (incluidos cambios locales y fuentes nuevas no
ignoradas) a un temporal, excluye archivos ocultos como `.env` y salidas previas,
y enlaza las dependencias instaladas. Ejecuta `build:app` con un entorno mínimo
sin claves, flags del producto ni hooks Node heredados. Comprueba que renderer,
main y preload existan y conserva `build-report.json` y artefactos. No carga
cuentas, arranca Electron, instala Python ni publica un instalador. No usar ese
bundle sin configuración como un release para usuarios.

El directorio temporal incluye una junction/enlace a `node_modules` del
worktree; no se elimina automáticamente. No recorrer ese enlace al retirar
manualmente los artefactos. La comprobación confía en el código y dependencias
locales revisados; no ejecutarla sobre un proyecto ajeno no confiable.

```powershell
npm run browser:smoke:native -- --download-runtime
# Alternativa sin otra descarga, con un ejecutable estable ya disponible:
npm run browser:smoke:native -- --electron "C:\ruta\electron.exe"
# Sólo cancelación del cierre y espera de limpieza, sin repetir las otras fases:
npm run browser:smoke:native -- --lifecycle-only --electron "C:\ruta\electron.exe"
# Cifrado DPAPI/migración y detección de formularios, de forma independiente:
npm run browser:smoke:native -- --vault-only --electron "C:\ruta\electron.exe"
npm run browser:smoke:native -- --autosave-only --electron "C:\ruta\electron.exe"
```

El runner exige la versión estable exacta de `package.json`. La descarga opt-in
usa GitHub oficial y verifica SHA-256 antes de extraer. No ejecuta npm install,
bootstrap, agentes, actualizador ni carga `.env`; no sustituye dependencias
compartidas. Cada ejecución usa un directorio temporal nuevo y ventanas ocultas.
Las páginas y descargas son fixtures HTTP de loopback; las solicitudes web de
la partición de prueba fuera de ese origen se bloquean. No usa cuentas reales.

Prueba módulos reales de descargas, SQLite/FTS, marcadores, sesión y barrera de cierre junto
con APIs nativas de búsqueda, PDF, zoom, silencio y traslado de vistas. Un
segundo proceso verifica persistencia y recuperación de respaldo después de
corromper únicamente la sesión de prueba. En marcadores comprueba revisión sin
escritura, importación, actualización con identidad conservada y persistencia;
la confirmación se invoca desde el harness, no mediante interacción humana con
los diálogos nativos. No sustituye pruebas UI/IPC integradas ni prueba la
restauración de vistas del servicio completo o fallos eléctricos.
El exportador de diagnóstico también corre con ventana y filesystem reales,
pero con ambos diálogos simulados por el harness. Verifica JSON saneado y
conservación de un destino existente; no sustituye la prueba humana de HITL.

La fase `lifecycle` usa el coordinador de salida real y un store de marcadores
real con una ventana oculta y una cookie de partición en memoria. Cancela
`beforeunload` y comprueba que no se borra; después verifica que `will-quit`
espera una limpieza deliberadamente retenida antes de terminar. La función de
limpieza es una fixture, no el `IntegratedBrowserService` completo: este último
se verifica por separado con regresiones de colas, perfiles y reapertura.
No arranca sidecars ni instala actualizaciones. La evidencia no cubre cierre
forzado, apagado del sistema, interfaz completa ni el instalador.

Las fases `vault` y `autosave` comprueban DPAPI real, migración/reapertura y
borrado del respaldo; `vault` también verifica diario de conflictos, persistencia
de decisiones y rechazo de ciphertext alterado/copiado a otro perfil. Se prueba
además el puente aislado, eventos sintéticos rechazados,
recarga, desconexión CDP y desmontaje. La entrada confiable de Chromium la genera
el harness; no demuestra interacción física humana ni verificación Windows Hello.

Conserva runtime, PDF, descargas, perfiles y reportes `exercise.json`/`restore.json`/`lifecycle.json`/`vault.json`/`autosave.json`
en el directorio temporal que imprime, para inspección/repetición; no elimina
archivos automáticamente. Código 0: casos focalizados sin limitaciones observadas;
código 2: casos ejecutados con limitaciones funcionales pendientes; otros errores
fallan la ejecución. El resultado ampliado del 2026-09-05 tiene 16 comprobaciones positivas
y una limitación: Electron 43 comparte zoom por origen. No se considera gate de
release aprobado. El timeout de cada proceso es de 90 segundos y el harness
nativo se aborta a los 60 segundos.

## Verificación local del esquema de sync

La migración `database/lia/migrations/browser-encrypted-sync.sql` no se ha
aplicado remotamente. No ejecutar snapshots, usar anon key sin sesión ni activar
sync sólo porque el SQL pasó localmente. Antes del despliegue autorizado: respaldo
de Lia, confirmar `auth.users`/`auth.sessions`/`auth.uid()`/`auth.jwt()`, probar
sesiones federadas con claim firmado `is_anonymous: false` y acceso PostgREST, refrescar su esquema y verificar aislamiento
en staging. La prueba local usa fixtures Auth, no comprueba firma JWT real ni
concurrencia entre conexiones. El transporte y la UI de dispositivos están
conectados en código, pero todavía no hay cliente de transferencia de datos.

El harness usa PGlite 0.5.8 instalado fuera del workspace, sin scripts npm:

```powershell
$syncSqlRuntime = Join-Path $env:TEMP ('pulse-sync-sql-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $syncSqlRuntime
npm install --prefix $syncSqlRuntime --ignore-scripts --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8
node scripts/quality/test-browser-sync-sql.mjs (Join-Path $syncSqlRuntime 'node_modules/@electric-sql/pglite')
```

No usa `.env`, red de datos ni perfiles reales; crea PostgreSQL en memoria y
conserva un reporte saneado en un directorio temporal nuevo. No añade dependencias
al producto. El rollback manual `database/lia/rollbacks/browser-encrypted-sync-disable.sql` revoca tablas,
columnas y funciones nuevas sin borrar datos; detener clientes primero porque no
cancela operaciones ya iniciadas. Reaplicar la migración restaura permisos.
Las cuotas de 100 dispositivos y 10.000 recibos no se purgan automáticamente:
definir su retención operativa antes de activar un rollout.

## Dispositivos de sincronización

La sección **Sincronización** del gestor del navegador consulta dispositivos
sólo con `BROWSER_ENCRYPTED_SYNC_ENABLED` y perfil autenticado. El flag permanece
apagado por defecto; esta fase no modifica configuración ni despliega SQL.
Una consulta verifica la sesión Lia con Auth antes de acceder a las RPC/tablas.
Si falta sesión, configuración o esquema, muestra error controlado y permite
reconsultar. No inventa un registro ni usa credenciales privilegiadas.

Registrar y revocar muestran confirmación nativa con cancelar por omisión.
`sync-device.json` conserva un ID aleatorio protegido por el SO, ligado al perfil,
backend y sesión Lia. Se escribe antes de registrar: tras un timeout/cancelación,
consultar de nuevo conserva la identidad para reconciliar el resultado remoto.
No borrar este archivo para forzar reintentos. Una sesión revocada necesita
nueva autenticación y consentimiento; no se reactiva cambiando el ID. La lista
usa etiquetas seudónimas, no nombres del equipo ni del usuario del SO.

Cancelar o cerrar el panel aborta la espera local, pero un diálogo nativo puede
seguir visible hasta responder; no se abre otra operación durante esa confirmación
y una aceptación tardía no autoriza una escritura. Una petición ya recibida por
el servidor puede haber terminado: cancelar no es rollback. La revocación no
retira copias ya descargadas. Registrar todavía no transfiere marcadores,
pestañas, grupos o ajustes, y nunca incluye contraseñas, cookies ni passkeys.

Rollback local: apagar el flag y reiniciar sin eliminar archivos de identidad,
claves o conflictos. Esto impide nuevas consultas locales, no revoca otros equipos.
Validar Auth/PostgREST, refresh y revocación entre dos sesiones en staging antes
de un despliegue autorizado. La regresión local usa HTTP y Auth simulados.

## Revisiones locales de sincronización

El motor y diario de conflictos están preparados, sin conexión al cliente ni
activación de sync. `sync-conflicts.json` contiene sólo una envoltura v1 de
safeStorage; base, local, remoto y selecciones quedan dentro del texto protegido
y ligados al perfil. No copiarlo a otra cuenta/perfil ni tratarlo como backup
portable: depende del almacén del SO, no del código de recuperación E2EE.

Una categoría pendiente no se sobrescribe por recibir otra revisión. Después de
resolverla, un CAS fallido permite comparar de nuevo con el remoto posterior,
sin reutilizar IDs de decisiones anteriores. El cliente de 7.3 deberá conservar
la revisión hasta confirmar commit remoto y aplicación local, y no inventar una
base vacía si perdió su última instantánea confirmada.

Corrupción, cuota, falta del almacén del SO o versión futura fallan cerrado y
conservan el archivo. No hay restauración ni limpieza automática de pendientes.
La escritura sincroniza un temporal exclusivo antes del reemplazo; si falla su
limpieza puede quedar un temporal cifrado. El rollback es mantener sync apagado
y preservar el diario para una versión compatible, sin borrar decisiones.
La validación local es `npm run test -- integrated-browser-sync --run --maxWorkers=1`;
no demuestra integración con Lia, UI ni procesos concurrentes externos.

## Matriz de respaldo

| Estado | Respaldo actual | Recuperacion |
|---|---|---|
| Supabase | gestionado fuera del repo; no probado aqui | restauracion del proyecto/proveedor con autorizacion |
| `hub_service_state` | espejo cloud de ciertos estados JSON | servicios restauran al iniciar segun implementacion |
| memoria SQLite | sin backup automatico versionado | copiar DB con app detenida y validar schema/ABI |
| knowledge Markdown | sin backup automatico | copiar `userData/knowledge/` |
| config JSON | parcial en cloud segun servicio | restaurar archivo compatible o usar defaults |
| credenciales WhatsApp/OAuth | proveedor/userData | reconectar y revocar sesion anterior si se perdio host |
| screenshots | no deben asumirse respaldados | conservar/eliminar segun privacidad, no restaurar por defecto |
| sesion del navegador | `.bak` de una generación, esquema v1/v2 | principal validado o respaldo si falta/está corrupto; requiere restauración explícita |
| bóveda del navegador | `.bak` cifrado y sobre v2 autenticado; al borrar, ambas copias omiten las credenciales retiradas | no recuperar automáticamente ni sobrescribir corrupción; sólo copia compatible del mismo entorno del SO y mismo ámbito de perfil/archivo |
| repo/codigo | Git | revert/branch/tag/release previo |

No hay RPO/RTO cuantitativo versionado. Decir “backup completo” seria incorrecto.

### Compatibilidad de la bóveda v2

Abrir v1 válida migra el principal y crea un respaldo cifrado v2, conservando
IDs y fechas. Ambos quedan ligados al nombre del archivo y al ámbito del perfil.
Una build antigua no lee v2: no hacer downgrade sin preservar las dos copias y
mantener un lector compatible. No se genera una copia legacy con metadata legible.
Para recuperar manualmente con la app detenida, preservar primero el principal
dañado, revisar fecha/contenido esperado del respaldo y restaurarlo al nombre
original sólo en el mismo entorno de cifrado. Puede perder cambios recientes;
no se probó recuperación ante corte eléctrico ni borrado físico irrecuperable.
Desactivar «Sugerir guardar al enviar un formulario» revierte sólo la detección,
no el formato ni las credenciales guardadas.

## Rollback de aplicacion

1. Detener rollout/update automatico si hay incidente.
2. Identificar version y migraciones incluidas.
3. Si no hubo migracion destructiva, instalar release anterior y conservar
   `userData` compatible.
4. Si cambio schema local, usar migracion down o copia verificada; no reemplazar DB
   con app abierta.
5. Si cambio Supabase, ejecutar rollback especifico de la migracion solo tras
   preflight/backup.
6. Revocar credenciales si el incidente fue de seguridad.
7. Registrar resultado y riesgo residual.

## Recuperacion de subsistemas

- Config JSON corrupta: servicios con loader tolerante vuelven a defaults; revisar
  que no active una opcion peligrosa.
- Sidecar Python fallido: status/restart hasta el maximo; voz y tools son procesos
  separados.
- WhatsApp: desconectar, eliminar sesion autorizadamente y volver a emparejar.
- Tool dinamica invalida: loader la retira; corregir contrato/reinstalar builtin,
  no relajar schema.
- Indice FTS: cerrar DB y reindexar fuentes; no es autoridad de contenido.
- Meeting sync parcial: reutilizar idempotency key y estado, no crear accion nueva.

## Verificacion previa a release

El catálogo del navegador se distribuye con revisión y huellas fijadas; agregar
una revisión exige inspeccionar su fuente oficial/licencia, verificar todos los
archivos y ejecutar `browser:smoke:native -- --electron RUTA --catalog-only`.
Ese modo descarga únicamente la revisión pública fijada dentro del temporal
de pruebas; la aplicación no descarga paquetes. Para actualizar en producto,
deshabilitar la extensión, cerrar páginas/dejar about:blank y revisar la carpeta
oficial desde el catálogo. Una reinstalación conserva restricciones por sitio.

Los stores SQLite de historial/bitácora/memoria no reparan una base ajena o un
esquema incompleto creando tablas vacías; los errores conservan el archivo.
Permisos ilegibles quedan sin escritura con defaults de navegación. No eliminar
el archivo para forzar el arranque ni copiar permisos/checkpoints antiguos.
En soporte del navegador, «Recuperar ajustes dañados» ofrece permisos,
privacidad y políticas del agente. Requiere archivo ausente/corrupto, respaldo
local compatible, perfil propio autenticado y confirmación nativa. No recupera
una versión futura ni un archivo inaccesible. La copia corresponde al estado
anterior a la última modificación de un principal válido; el primer guardado
no crea copia. Puede perder cambios recientes y retira concesiones/excepciones.

Antes de aceptar, revisar que sea el perfil correcto; después revisar los
ajustes y conceder de nuevo sólo lo necesario. No renombrar manualmente el
respaldo sobre el JSON: está cifrado y ligado a su ámbito. Se conserva una copia
cifrada del original dañado (hasta cinco, sin purga automática). Alcanzar la
cuota requiere revisión manual con la aplicación detenida; no borrar evidencia
automáticamente. Restablecer permisos retira todas sus copias locales y lo
advierte en pantalla. No hay restauración de dispositivos revocados ni downgrade
de esquemas.

Historial y bitácora también ofrecen recuperación desde soporte con confirmación
nativa. Requieren una copia SQLite compatible protegida por el SO; rechazan
principales sanos, futuros o con transacciones pendientes. La copia se genera
tras una escritura válida y rota como máximo cada 30 segundos; un fallo del
respaldo se advierte sin anunciar falsamente que falló guardar los datos.
Revisar el número de entradas y la posible pérdida de cambios recientes.
Se vuelve a aplicar la retención vigente antes de publicar; el historial
reconstruye su índice de búsqueda sin reimportar el legado. Borrar datos o
reducir retención retira antes las copias anteriores para evitar recuperarlos
después. El historial principal sigue siendo SQLite sin cifrado completo.

También puede recuperarse la biblioteca de atajos desde soporte: requiere
gobierno del agente habilitado y permitido por la organización. Actualizar su
lista después de recuperar, revisar instrucciones y seleccionar páginas nuevas;
IDs/recibo se renuevan y no se ejecuta nada. Eliminar un atajo retira todas las
copias de recuperación de la biblioteca; la confirmación nativa lo advierte.
En Datos sincronizados, «Recuperar configuración dañada» restaura únicamente
preferencias locales desde copia compatible, con transferencia desactivada.
Consultar de nuevo la configuración antes de elegir categorías. No restaura
claves, dispositivos revocados, checkpoints o decisiones pendientes.
Las claves conservan su recuperación explícita existente.

«Recuperar checkpoints y conflictos» requiere configuración válida y metadata
dañada/incoherente: conserva los originales cifrados, pausa categorías y vacía
los puntos de avance y decisiones. No contacta al servidor ni cambia claves,
dispositivos o los datos del navegador. Al reactivar, revisar de nuevo la
primera sincronización; no se reutilizan aprobaciones antiguas.
Si el reemplazo se interrumpe, el marcador protegido bloquea todas las
operaciones ordinarias. Usar «Revertir recuperación incompleta» y confirmar
para restaurar los tres archivos originales, incluida su ausencia cuando
corresponda. Esto puede devolver la corrupción original y no deshace escrituras
remotas. No borrar manualmente el marcador para habilitar sync ni mezclar copias
antiguas. Un marcador ilegible, cambios externos o cinco archivos de evidencia
requieren revisión con la app detenida. No hay rollback atómico de todo el
perfil, downgrade automático ni garantía frente a pérdida del disco.

`npm run browser:smoke:native -- --electron RUTA_ABSOLUTA --policies-only`
verifica 19 casos de políticas, atajos, memoria, historial, bitácora y estado
sync con safeStorage/DPAPI: recuperación, borrado de copias, reapertura,
rechazo de alteración y reversión tras fallo parcial. Sólo usa archivos de prueba en un
directorio temporal nuevo; no acredita el recorrido humano UI/IPC ni el
instalador. La fase también forma parte de la matriz nativa sin red externa.

Para restauración y rollback de sesiones del navegador, consultar
[persistencia de la plataforma](../architecture/integrated-browser-platform.md#persistencia-y-recuperación).
Antes de volver a código que sólo lee v1, detener la aplicación y conservar una
copia del principal v2 y de su respaldo. La migración inicial mantiene v1 en
`.bak`, pero guardados posteriores lo rotan: no asumir que cualquier `.bak` es
compatible con el binario anterior. No reemplazar automáticamente una sesión
de versión futura ni usar archivos `.corrupt-*` sin validarlos. Desactivar el
flag de restauración evita consumir la sesión; no convierte el esquema ni
elimina las particiones, marcadores o historial.

El documento interno de la bóveda v2 conserva el formato de credenciales v1;
el archivo exterior y su respaldo ya requieren lector v2. El límite de cifrado
base64 por entrada es 24 KiB para contraseñas Unicode de 4.096 unidades UTF-16. Un
binario anterior con límite de 16 KiB puede rechazar esas entradas nuevas:
antes de un downgrade conservar una copia con la app detenida y mantener la
corrección del lector. No truncar ni eliminar cuentas para forzar compatibilidad,
ni asumir que copiar el archivo cifrado a otro equipo permite descifrarlo.

`verify:release`, artifacts esperados, smoke Linux, firma/notarizacion cuando se
incorpore, notas de version, ruta de updater y plan de rollback. El workflow actual
no documenta firma Windows ni notarizacion Apple; no se presentan como activas.
