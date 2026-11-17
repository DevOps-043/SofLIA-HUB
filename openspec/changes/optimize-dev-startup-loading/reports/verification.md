# Evidencia de carga y arranque dev

Fecha: 2026-11-17. Rama codex/optimize-build-runtime; se preservan las cuatro etapas previas y el índice existente.

## Diagnóstico confirmado y límites de atribución

El log aportado no tiene timestamps en cada línea. Registra Vite listo en 369 ms, preload 5554 ms, main 15381 ms y otro main 1954 ms. El hito app:ready del reloj anterior es 13625 ms y ventana:visible 14788 ms. No puede deducirse que dotenv tarde 30 segundos: hay imports/constructores entre esos mensajes y el reloj anterior comenzaba al evaluar boot-timeline.

Una reproducción con fuentes copiadas sin .env, perfil temporal y arranque Electron sustituido por contador muestra preload y dos builds main iniciales, con dos solicitudes de arranque. Se reproduce también sólo con main. Ambos bundles main tienen la misma huella de todas sus salidas: f569445e64c109a2d150e0c3b8981cd936642279bab2cce42986f58f477a76df en el fixture observado. No se atribuye la causa interna del rebuild a dotenv, preload o antivirus sin evidencia. No se cambió la versión de Vite/Rolldown ni se desactivó el watcher.

## Cambios y verificaciones dirigidas

- Carga concurrente: conserva las 67 exportaciones, espera al módulo lento, no publica conjunto parcial, propaga fallos. Dos pruebas aprobadas.
- Reloj: incluye evaluación estática anterior a boot-timeline y mantiene duración entre hitos. Una prueba aprobada.
- Entorno: se configura antes de cargar módulos concurrentes; un fallo de carga no construye servicios. Una prueba aprobada sin leer configuración real.
- Coordinador dev: huella incluye todos los chunks y assets; mismo contenido no reinicia, cambios sí, solicitudes iguales comparten promesa, cambios sucesivos no solapan arranque, fallo permite reintentar, incluida vuelta A→B fallido→A. Cuatro pruebas Node aprobadas.
- Typecheck aprobado tras código y coordinador.
- El build aislado detectó que su allowlist anterior omitía seis fuentes Zoom ya existentes (TS2307) y CHANGELOG.md consumido por el renderer (UNRESOLVED_IMPORT). Se completó la lista explícita de fuentes copiadas (sin incluir perfiles, .env ni node_modules). Se repite el build sobre fuentes finales.
- Smoke del config Vite real copiado, sin .env ni Electron/usuarios reales: tres builds iniciales pero una solicitud de arranque. Editar código main produce la segunda; editar preload conserva reload del renderer y total de dos arranques. Exit 0. No se modifica ninguna fuente del checkout para este smoke.

Comandos focalizados: `npx vitest run bootstrap-environment-order startup-module-loading boot-timeline` (cuatro pruebas); `node --test scripts/quality/dev-main-restart.test.mjs` (cuatro pruebas). QA aislado de diagnóstico ejecutado con scripts temporales bajo tmp; sus outputs son evidencia local, no una nueva API del producto.

## Mediciones

Tres pares alternados de imports compilados en Electron aislado, sin ejecutar runBootstrap, sin ventanas, conexiones o capturas; se evalúan imports y constructor DesktopAgent con perfil temporal. Sin builds de diagnóstico simultáneos durante estos pares:

| Carga de módulos | Muestra 1 | Muestra 2 | Muestra 3 | Mediana |
|---|---:|---:|---:|---:|
| Secuencial anterior | 3283 ms | 3099 ms | 3289 ms | 3283 ms |
| Concurrente | 3264 ms | 2845 ms | 2888 ms | 2888 ms |

Mediana de este tramo aproximadamente 12% menor. Es un benchmark de imports con cachés del SO calientes; no del tiempo npm→login ni del uso global de RAM. El constructor nativo del DesktopAgent tarda 184–296 ms en estos pares, por lo que no se acredita que explique por sí solo la pausa original. Los imports estáticos previos están fuera de la fila comparada y se miden por separado (1123–1310 ms).

El build del profiler desactiva tree shaking porque la entrada diagnóstica produce un fallo interno de Rolldown con esa optimización; no se cambia el build productivo. Las muestras con builds de diagnóstico simultáneos se descartaron para comparar tiempos. El coordinador elimina una solicitud de arranque idéntica (2→1) en el fixture dev; no atribuirle 30 segundos ahorrados sin medir el próximo arranque real.

## Verificación integral y revisión

`npm run app:smoke:build`: aprobado con código cero. Ejecuta build:app completo (typecheck, renderer, main, preload, presentaciones, audiovisual y Zoom) en copia de fuentes sin .env ni perfiles, y valida todos sus artefactos. Mantiene reporte gzip en producción. No abre la aplicación ni genera instalador. Evidencia local: tmp/startup-build-complete.log; sandbox pulse-app-build-PuxeKc.

Revisión adversarial local: exports completos; entorno antes de imports; fallo antes de construir; hooks main/preload; huellas de código/assets; solicitudes iguales y sucesivas; reintento tras fallo y vuelta a versión anterior tras cerrar el hijo; gate de producción sin plugin dev; fuentes de build aislado limitadas a allowlists. No se añadieron permisos ni se omitieron handlers. Se corrigió el estado de versión iniciada tras fallo para permitir recuperar el proceso anterior con un arranque real. No se archiva el cambio.

`npm run verify:pr`: aprobado completo con código cero sobre los cambios acumulados:

- Adaptadores, arnés, suministro, CI, Electron estable, documentación, semilla y OpenSpec aprobados.
- 70 pruebas de tooling y 33 contratos Python aprobados. Python 3.12.11 temporal elegido sólo por proceso mediante SOFLIA_TEST_PYTHON; sin modificar configuración local.
- Typecheck aprobado; lint incremental de 89 archivos sin deuda nueva.
- Suite global: 656 archivos aprobados y dos omitidos; 7629 pruebas aprobadas y cinco omitidas (preexistentes). Duración 497,30 s; no es un benchmark de arranque.
- Cobertura validada en las 2743 fuentes productivas: líneas 63,59%, sentencias 61,69%, funciones 58,16%, ramas 54,92%. Sin reducir pisos ni exclusiones.

Documentación sincronizada (857 archivos de prueba), enlaces activos y OpenSpec strict aprobados; diff sin errores de whitespace. Evidencia local del gate: tmp/startup-verify-pr.log. No se publicó ni empaquetó instalador.

## Riesgos y reversión

La huella sólo decide reiniciar en dev: el watcher sigue compilando y el coste de ese build adicional sigue existiendo. No se promete una reducción universal de los 60 segundos medidos por el usuario. Tampoco se acredita todavía rendimiento frío tras reiniciar Windows ni arranque con cuentas reales a partir de fixtures.

La cola puede ejecutar varios reinicios ante cambios reales sucesivos; evita solaparlos. Un fallo de import mantiene el comportamiento de rechazar bootstrap; no se silencian fallos de servicios ni se eluden guardas IPC. No se lee ni modifica .env para diagnosticar, ni se alteran credenciales, permisos, APIs, sesiones, datos o funciones.

Reversión: diff de esta etapa, manteniendo las etapas anteriores. No se genera instalador ni se publica nada.

## Seguimiento del build main

La segunda medición del usuario fue de 50 segundos hasta ver la aplicación. En el adjunto, el preload tarda 6299 ms y el primer main 31348 ms. Vite escanea y reoptimiza dependencias del renderer en ese arranque. El entorno tarda 2 ms, la carga de módulos de Electron 3149 ms y la ventana se revela a 7481 ms del origen de Node main. El usuario midió unos 12,83 s entre las líneas de transformación y el final de la fase observada.

El inventario del bundle detectó el SDK de WhatsApp y sus transitivas dentro del build, aunque su ejecución ya era diferida. Vite ya desactiva la copia de `public` para los bundles de Electron. Se externalizó sólo Baileys en main de desarrollo. Electron lo importa desde `node_modules` al conectar o cuando se solicita la descarga del hub heredado. Producción sigue usando el bundle del SDK. La comprobación usa el paquete instalado y el ejecutable Electron del proyecto.

Tres pares alternados con fuentes copiadas, caché Vite nueva por proceso, mismo código fuente y variante con SDK empaquetado o externo. El arranque de Electron se sustituyó por un contador durante la medición. La fase de emisión se mide desde `renderStart` hasta `writeBundle`. Incluye generación y escritura, aparte de la salida del reporter.

| Fase | Variante | Par 1 | Par 2 | Par 3 | Mediana |
|---|---|---:|---:|---:|---:|
| Emisión del primer main | SDK empaquetado | 5,833 s | 1,878 s | 1,440 s | 1,878 s |
| Emisión del primer main | SDK externo | 3,961 s | 1,059 s | 0,575 s | 1,059 s |
| Primer build main completo | SDK empaquetado | 20,783 s | 16,402 s | 14,188 s | 16,402 s |
| Primer build main completo | SDK externo | 20,946 s | 20,273 s | 7,885 s | 20,273 s |
| Segundo build main | SDK empaquetado | 3,376 s | 2,997 s | 2,304 s | 2,997 s |
| Segundo build main | SDK externo | 1,652 s | 2,188 s | 1,260 s | 1,652 s |

La emisión ahorró 0,819–1,872 s en cada par. El total del primer build fue variable mientras también se optimizaba el renderer. Se transforman 1616 módulos frente a 1933 (317 menos). El archivo de conexión de desarrollo pasa de unos 6,20 MB a unos 28 kB. Se conserva la misma funcionalidad en el paquete instalado. No se extrapola el resultado a los 50 segundos del usuario.

- `npx vitest run whatsapp-service whatsapp-connection-lifecycle whatsapp-reconnect-lifecycle whatsapp-remote-hub`: 66 pruebas aprobadas. La prueba de carga difiere el mock, revoca el intento y comprueba que no toca el directorio de autenticación ni crea un socket. La reconexión posterior funciona con el mismo SDK.
- Smoke del bundle dev en Electron 44.9.3, Node 24.22.0 y perfil temporal: el import ESM nativo resuelve desde el chunk compilado y la operación se detiene antes de usar datos, credenciales o red.
- Smoke Vite dev con edición de main y preload en copia aislada: una solicitud inicial, una al cambiar main y una recarga al cambiar preload. Se preserva la deduplicación de builds idénticos.
- `npm run app:smoke:build` aprobó la compilación completa de producción con fuentes aisladas. El SDK quedó en un chunk diferido de 4,64 MB. Electron con perfil temporal cargó ese bundle y pasó el mismo escenario de revocación, sin un import externo de Baileys en el código emitido.
- `npm run docs:check`, OpenSpec strict y `git diff --check` aprobados.
- `npm run verify:pr` aprobado con código cero. 7629 pruebas de aplicación, 70 de tooling y 33 contratos Python aprobados. Se mantienen las cinco omisiones preexistentes. Lint sin deuda nueva en 91 archivos. Cobertura validada en 2743 fuentes: 63,59% de líneas, 61,69% de sentencias, 58,16% de funciones y 54,93% de ramas.
