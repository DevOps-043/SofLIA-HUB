## 1. Línea base y contratos

- [x] 1.1 Registrar baseline de typecheck y pruebas actuales del navegador en reports/baseline.md.
- [x] 1.2 Definir tipos cerrados para descargas, herramientas de página, sesión, marcadores, perfiles, privacidad, agente, sync y diagnóstico.
- [x] 1.3 Añadir flags de capacidad con defaults seguros y pruebas de configuración. Los gates P0 de descargas, herramientas de página, marcadores y pestañas avanzadas son efectivos; perfiles, historial avanzado, privacidad, agente, empresa y sync permanecen apagados por defecto y se activan sólo con variables explícitas.

## 2. Herramientas de productividad P0

- [x] 2.1 Implementar servicio main de descargas con destinos saneados, progreso, cancelación y reanudación.
- [x] 2.2 Completar IPC de descargas en handler, allowlist, preload, tipos globales y wrapper renderer.
- [x] 2.3 Implementar panel de descargas y pruebas de progreso, error, cancelación y reapertura.
- [x] 2.4 Implementar búsqueda en página con resultados, avance, retroceso y cierre.
- [x] 2.5 Implementar zoom aislado por pestaña, reset y límites. En Electron 43 usa emulación desktop por WebContents con base Chromium uno, 50–300%, reflujo, puntos DOM/autofill transformados y adaptación al resize/navegación. Runtime con aislamiento nativo conserva esa API. Zoom, captura, entrada, reset, vecino del mismo origen y PDF verificados en Electron real; detalle en el corte 2026-09-11.
- [x] 2.6 Implementar silencio, fullscreen, impresión y guardado PDF con diálogos nativos y validación.
- [x] 2.7 Añadir comandos visibles, menús contextuales y atajos accesibles para las herramientas P0.

## 3. Pestañas y restauración

- [x] 3.1 Extender el estado de pestaña con fijación, silencio, grupo, posición, historial mínimo y metadata restaurable.
- [x] 3.2 Implementar store versionado de sesión con escritura atómica, cuota y recuperación ante corrupción.
- [x] 3.3 Restaurar sesión después de cierre normal o inesperado sin formularios ni contenido sensible. Barrera de cierre e instalación con timeout/HITL implementada; smoke nativo pendiente en 9.5.
- [x] 3.4 Implementar reabrir cerrada, duplicar, cerrar otras y cerrar a la derecha.
- [x] 3.5 Implementar grupos nombrados/coloreados y persistir su orden.
- [x] 3.6 Implementar tira vertical opcional y navegación completa por teclado.
- [x] 3.7 Cubrir suspensión, restauración, ventanas separadas y vista dividida con pruebas de regresión. Disco temporal real y dobles Electron; smoke nativo sigue en 9.5.

## 4. Perfiles y datos P1

- [x] 4.1 Implementar perfiles autenticado, invitado y privado con particiones y lifecycle aislados. Particiones separadas, confirmación nativa y logout verificados. Se drenan los stores del perfil saliente antes de purgar al cambiar o cerrar realmente la ventana; cancelar `beforeunload` conserva la sesión. Reapertura y `will-quit` esperan limpieza, con reintento/salida incompleta explícita ante fallo. Regresión y smoke focalizado de lifecycle en Electron estable aprobados; cierre forzado/apagado puede dejar temporales.
- [x] 4.2 Implementar store main de marcadores con carpetas, etiquetas, búsqueda, orden y migración desde localStorage.
- [x] 4.3 Completar IPC/UI de marcadores e importación/exportación HTML.
- [x] 4.4 Migrar historial a SQLite con URLs/visitas, FTS, paginación, filtros y compatibilidad JSONL.
- [x] 4.5 Completar UI de historial con fecha, dominio, cerradas recientemente y retención.
- [x] 4.6 Añadir importador con preflight, conflictos, resumen y redacción para datos de navegadores soportados. Marcadores HTML, historial JSON/JSONL (incluido `last_visit_time` de Chromium) y credenciales JSON tienen revisión nativa; quedan formatos adicionales y perfiles de otros navegadores.
- [x] 4.7 Implementar generador y análisis local de contraseñas débiles/reutilizadas.
- [x] 4.8 Implementar oferta de guardar/actualizar y autenticación del SO antes de operaciones sensibles. Windows Hello/PIN vía HWND, lease de cinco minutos, bloqueo manual/SO/perfil y guardas de revisiones. SPA sin submit y SSO en la misma pestaña antes de revisión conservan el origen inicial; otros flujos ambiguos mantienen guardado manual, nunca comparten contraseñas entre dominios. Observador real de Chromium y disponibilidad nativa Windows verificados; aceptación/cancelación interactiva del producto se conserva en 9.5, no se presume resultado de login ni soporte SO fuera de Windows.
- [x] 4.9 Implementar importación/exportación de credenciales con HITL, destino explícito y pruebas negativas. Transferencia JSON sólo desde main, advertencia nativa, revisión de conflictos, límite de 5 MB, escritura exclusiva y sin secretos en IPC/UI.
- [x] 4.10 Integrar passkeys del proveedor del sistema sin exponer material privado. WebAuthn permanece en Chromium/proveedor nativo; selector de cuentas main con cancelación, plazo, guardas de sesión/documento/foco/control y barrera de identidad al agente, sin IPC ni persistencia de claves/IDs. Disponibilidad Windows y autenticador virtual comprobados; aceptación humana con Windows Hello/llave, otras UI nativas y autofill condicional no se acreditan: interacción de producto sigue en 9.5.

## 5. Privacidad y extensiones P2

- [x] 5.1 Implementar motor de reglas de rastreo con listas versionadas, límites y verificación.
- [x] 5.2 Integrar bloqueo de solicitudes, cookies de terceros, parámetros de tracking y mitigaciones de fingerprinting compatibles. Se eliminan client hints de alta entropía y opt-in Accept-CH en privacidad estricta, conservando hints básicos y User-Agent compatible.
- [x] 5.3 Implementar store y panel por sitio con nivel, categorías, excepciones y contador local.
- [x] 5.4 Implementar contrato de navegación segura local y proveedor remoto opcional con timeout/degradación. Plazo total, cuerpo 4 KiB, sin redirecciones/credenciales ni consultas en perfiles efímeros/destinos locales conocidos. La barra muestra avisos por pestaña, distingue degradación y bloqueo, conserva precedencia local y rechaza dictámenes obsoletos; no persiste reputación. Intersticiales y rutas remotas adicionales siguen en 5.5.
- [x] 5.5 Integrar protección con navegación, ventanas emergentes, descargas y errores de certificado. Revisión remota conectada a solicitudes gobernadas, además de guardas locales sin flags; intersticiales main aislados en pestañas/ventanas, sin bypass ni observación detrás del bloqueo. Doce comprobaciones nativas de tráfico, marcos, ventanas hijas, descarga, TLS autofirmado y acciones del aviso aprobadas. El smoke completo del producto continúa en 9.5.
- [x] 5.6 Añadir permisos por sitio a extensiones y restringir acceso a archivo/incógnito. Panel y cuatro capas IPC reducen el manifiesto de MV3 compatibles storage/scripting, con extensión deshabilitada y páginas cerradas/blancas. Selección por dominio/protocolo exactos, todos los puertos; recuperar permisos exige reinstalar. Se conservan rechazo de perfiles efímeros y `allowFileAccess: false`, integridad, cuotas y guardas. Chromium real verifica scripts estáticos, persistentes y scripting dinámico frente a hosts retirados. No es cortafuegos ni paridad completa con Chrome.
- [x] 5.7 Implementar catálogo curado de extensiones compatibles con firma/huella y actualización explícita. Catálogo inicial del ejemplo oficial Reading Time de GoogleChrome, commit y siete SHA-256 fijados en la aplicación; fuente visible, carpeta seleccionada y confirmación explícitas, sin descargas/actualizaciones automáticas ni PGP en runtime. Actualización prepara/carga copia nueva antes de reemplazar registro, conserva sitios revocados y copia anterior ante fallos o concurrencia. Guardas de titular, sesión/ventana/perfil/control, cuatro capas IPC, UI y paquete oficial comprobados en Electron real. No es Chrome Web Store ni catálogo general; revisiones nuevas requieren nuevos pines revisados.

## 6. Gobierno avanzado del agente P2

- [x] 6.1 Implementar store de política por origen con modos estricto/equilibrado y decisiones una vez/siempre/bloquear.
- [x] 6.2 Aplicar la política antes de DOM, captura, lectura de documento y acción. Guardas iniciales y auditoría de carreras/cancelación del driver verificadas; detener/pausar/tomar control end-to-end permanece en 6.4.
- [x] 6.3 Añadir selector @pestaña, fuentes múltiples y citas de fragmentos en resultados. Selector `@`/menú con búsqueda y teclado, ocho pestañas máximo; recibo de perfil/documento y lectura fresca main acotada, revalidación del lote, plazo/cancelación de preparación sin falsos éxitos. Fragmentos persistidos con el chat y reutilizados al regenerar; citas desplegables y avisos de referencias ausentes/inexistentes. Ambos proveedores cierran lecturas/búsquedas implícitas y el dispatcher sólo conserva workspace de la Skill elegida, sin nuevas descargas. Pruebas automatizadas main/IPC/renderer; smoke de producto permanece en 9.5.
- [x] 6.4 Implementar detener, pausar y tomar control con cancelación real y outcome estructurado. Supervisor CU, fases cancelables, espera hasta drenaje nativo, reanudación con captura nueva y presupuesto acumulado, controles dedicados, recibos de ejecución/perfil, retiro de avisos obsoletos y contrato main/handler/preload/renderer probados. Cierre de implementación automatizada; smoke del producto completo y del instalador Windows permanece en 9.5, no se declara ejecutado.

  Evidencia: [supervisión y cancelación por fases](reports/verification-agent-supervision-2026-09-10.md).
- [x] 6.5 Implementar handoff obligatorio para pagos, identidad, datos médicos, secretos y valores de autofill. Sonda local conservadora y cerrada ante estructuras no inspeccionables, controles antes/después de lectura/captura, cancelación CU con drenaje y aviso sin override. Indicador persiste hasta documento nuevo. No se atribuye detección universal de texto/imágenes ni cobertura global de capturas desktop.
- [x] 6.6 Implementar bitácora saneada y cifrada con retención, consulta y borrado HITL. SQLite v1 por perfil, detalle protegido por el SO, trazas de operaciones DOM/Computer Use y decisiones de política; sin argumentos, formularios, capturas ni errores crudos. Consulta paginada y retención 7/30/90 días, 5.000 eventos máximo. Cuatro capas IPC/UI, confirmaciones nativas de cinco minutos y pruebas negativas de corrupción, contexto, expiración y concurrencia; DPAPI real verificado. Registro bajo el gate agentGovernance, sin afirmar éxito del objetivo a partir del resultado de una operación.
- [x] 6.7 Implementar atajos agénticos reutilizables con alcance y permisos cerrados. Biblioteca cifrada por perfil persistente, CRUD con revisión y borrado HITL, cuatro capas IPC y menú del compositor. Atajos de lectura `selected-tabs` / `read-fragments`: borrador revisable sin envío automático, selección fresca obligatoria y rechazo de Skills, otros adjuntos o modos que amplíen el alcance. Bajo agentGovernance; no macros de acciones ni sync. Pruebas main/IPC/UI/rutas aprobadas; smoke de producto en 9.5.
- [x] 6.8 Implementar índice semántico opt-in de historial/marcadores con cuotas, fuentes y borrado. SQLite protegido por SO, consentimiento nativo sobre metadata enviada a Google, 400 fuentes/768 dimensiones/30 días, cancelación, escritura transaccional y revalidación de fuentes. Borrado explícito del índice; fuentes retiradas se depuran en la siguiente búsqueda, sin resultados obsoletos.
- [x] 6.9 Integrar voz de Orbe con pestañas y tareas sin crear otro runtime de agente. Prefijo y acciones cerrados, emisor Orbe visible autenticado, recibos vigentes y confirmación nativa para reanudar; sin DOM, títulos ni URL en respuesta.

## 7. Sync cifrado P3

- [x] 7.1 Diseñar migración Lia aditiva para dispositivos, envelopes cifrados, versiones e idempotencia con RLS. SQL y rollback no destructivo preparados; PostgreSQL local verifica reejecución, aislamiento por titular/sesión, revocación, categorías cerradas, CAS e idempotencia. No se aplicó SQL remoto ni se conectó el cliente; prueba en Lia/servicios de Auth reales sigue siendo requisito del rollout.
- [x] 7.2 Implementar cifrado autenticado, generación/protección de clave y código de recuperación.
- [x] 7.3 Implementar cliente sync selectivo con adaptador local y remoto, backoff, cancelación y estado. Controlador, cuatro categorías, adaptadores reales, checkpoints protegidos, revisión inicial, CAS/rebase, reintentos idempotentes y aplicación con guardas integrados. Recorrido con dos perfiles y servidor HTTP de prueba aprobado, incluida reapertura sin eco y revocación. Sin transferencia periódica; despliegue y Auth/RLS Lia reales siguen siendo condición del rollout en 9.5.
- [x] 7.4 Implementar resolución determinista de conflictos por tipo y conservación de conflictos manuales. Motor main de tres vías, decisiones ligadas a contenido/versiones, diario protegido por el SO, reapertura y rebase tras CAS verificados. No aplica resultados a stores activos ni conecta servidor/UI; esos consumidores permanecen en 7.3 y 7.6.
- [x] 7.5 Implementar registro y revocación de dispositivos sin exponer identificadores directos. Identidad aleatoria protegida por el SO y ligada a sesión Lia, verificación Auth, consentimiento nativo, cuatro IPC y panel de dispositivos implementados. Guardas de perfil/ventana/control, cancelación e inventario revocado concurrentemente probados. No despliega SQL ni acredita integración Auth/PostgREST entre equipos reales; requiere staging antes de rollout.
- [x] 7.6 Completar IPC/UI de activación, categorías, estado, recuperación y desconexión. sync-control cerrado conecta categorías, ejecución bajo demanda, pausa, claves por archivo main-only y revisión inicial/conflictos con HITL; conserva registro/revocación/cancelación existentes. Claves, códigos y rutas no cruzan IPC. Regresión main/handler/preload/wrapper/UI aprobada; sin habilitar backend real ni anunciar integración de producción.
- [x] 7.7 Verificar que tipos secretos se rechazan antes de cifrar o transmitir.

## 8. Empresa y lifecycle P3

- [x] 8.1 Implementar esquema cerrado y store de políticas empresariales con última versión válida.
- [x] 8.2 Aplicar precedencia administrada a sitios, privacidad, extensiones, retención y agente. Política cargada antes de mutaciones; bloqueo de navegación/red HTTP(S) y privacidad forzada aun con flags locales apagados; estado de verificación visible y guardas contra perfiles obsoletos.
- [x] 8.3 Implementar telemetría local agregada y exportación saneada con autorización. Instantánea bajo demanda del perfil propio, fuentes y periodo explícitos, confirmación nativa y destino JSON nuevo; sin envío remoto ni recolección histórica.
- [x] 8.4 Implementar diagnóstico del runtime y UI de soporte sin rutas ni identificadores sensibles.
- [x] 8.5 Sustituir la beta de Electron por la versión estable compatible o documentar excepción temporal con vencimiento. Electron 43.4.0 instalado localmente en este worktree; manifiesto, lockfile, paquete y ejecutable real coinciden mediante runtime:stable. Portapapeles adaptado a la API estable y matriz nativa ejecutada. No se alteró la instalación del padre; empaquetado completo permanece en 9.5 y zoom aislado en 2.5.
- [x] 8.6 Añadir compuerta que rechace prereleases no autorizadas en release.
- [x] 8.7 Añadir migraciones versionadas, respaldos y rollback de stores del navegador. Sesión y bóveda v1→v2, recuperación HITL de marcadores/bóveda y borrado de copias verificados. SQLite crea DDL/versiones en transacción y rechaza bases futuras, ajenas o incompletas. Permisos/privacidad/agente recuperan proyecciones restrictivas con contexto vigente; atajos renuevan IDs sin ejecución y configuración sync queda pausada. Memoria semántica recupera base vacía sin vectores/fuentes ni activación. Historial y bitácora añaden snapshots SQLite protegidos, recuperación HITL con retención vigente y FTS, y borrado previo de copias antiguas. Checkpoints/diario dañados se reconstruyen con categorías pausadas y originales protegidos; marcador persistente bloquea operaciones ante fallo parcial y permite reversión coordinada de los tres archivos locales con HITL, sin reutilizar decisiones ni tocar claves/dispositivos. Verificado con DPAPI real y fallos inyectados. No implica rollback atómico entre todos los stores, downgrade automático ni undo remoto; la reversión de aplicación exige flags/copias compatibles y app detenida. Evidencia y límites en el reporte SQLite/sync del 2026-09-12.

## 9. Documentación, verificación y cierre

Último corte: [instalador Windows y Python privado el 2026-09-13](reports/verification-installer-python-2026-09-13.md).
**63/64 completas y 1 pendiente** (9.5). Typecheck y verify:pr completos aprobados (3427 pruebas/317 archivos), además de 35 pruebas Python. Python preparado y revalidado, bienvenida NSIS propia revisada en vista nativa y EXE de prueba sin .env/firma/publicación generado con ASAR y sidecars comprobados. No equivale a instalación real ni release. El [cierre de bloqueos](reports/verification-pr-blockers-2026-09-13.md) conserva las correcciones de WhatsApp, semilla y generador de presentaciones.
El [corte SQLite/sync](reports/verification-sqlite-sync-recovery-2026-09-12.md) conserva el cierre de 8.7 con recuperación local, borrado de copias y reversión coordinada verificadas; sus bloqueos generales quedan superados por el corte actual.
Los cortes de [atajos/configuración sync](reports/verification-shortcut-sync-recovery-2026-09-12.md), [memoria SQLite](reports/verification-semantic-sqlite-recovery-2026-09-12.md) y [ajustes restrictivos](reports/verification-policy-recovery-2026-09-12.md) conservan la evidencia incremental anterior.
El [corte de catálogo y conservación de almacenes](reports/verification-extension-catalog-store-guards-2026-09-11.md) conserva evidencia del cierre de 5.7.
El [corte de passkeys/extensiones por sitio](reports/verification-passkeys-extension-sites-2026-09-11.md) conserva evidencia de 4.10 y 5.6.
El [corte anterior de cinco tareas](reports/verification-browser-five-tasks-2026-09-11.md) queda como evidencia histórica.
Prevalece sobre los recuentos históricos siguientes; no cierra 9.5 ni el rollout.

Evidencia parcial: [verificación del 2026-09-04](reports/verification-2026-09-04.md).
Continuación: [recuperación de sesiones del 2026-09-05](reports/verification-2026-09-05.md).
Continuación de cierre: [barrera de guardado e instalación](reports/verification-shutdown-2026-09-05.md).
Continuación de datos: [revisión e importación de marcadores HTML](reports/verification-bookmark-import-2026-09-05.md).
Continuación de datos: [importación revisada de historial](reports/verification-history-import-2026-09-05.md).
Continuación de perfiles: [aislamiento autenticado, invitado y privado](reports/verification-browser-profiles-2026-09-05.md).
Continuación de soporte: [diagnóstico local exportable](reports/verification-diagnostic-export-2026-09-05.md).
Continuación del agente: [contexto y cancelación de tareas visuales](reports/verification-agent-governance-2026-09-05.md).
Continuación de contraseñas: [guardado manual y actualización revisada](reports/verification-credential-save-2026-09-05.md).
Continuación empresarial: [precedencia administrada y guardas de red](reports/verification-enterprise-controls-2026-09-05.md).
Continuación de productividad: [zoom por pestaña y fallback de Electron](reports/verification-browser-zoom-2026-09-05.md).
Continuación de navegación segura: [contrato local y proveedor remoto opcional](reports/verification-safe-navigation-2026-09-05.md).
Auditoría y continuación: [navegación, extensiones y confirmación de perfiles](reports/verification-browser-boundaries-2026-09-05.md). Esta revisión reabre 4.1, 5.4 y 5.5 porque sus cierres anteriores no cubrían el contrato completo.
Continuación posterior: [limpieza efímera y avisos de navegación](reports/verification-profile-cleanup-and-safety-ui-2026-09-06.md). Cierra 4.1 y 5.4 con cancelación/reapertura, colas, espera nativa del proceso y avisos por pestaña verificados; 5.5 permanece abierta.
Continuación de seguridad y datos: [bóveda v2, oferta de guardado y esquema de sync](reports/verification-password-manager-and-sync-2026-09-07.md). Cierra 7.1 con PostgreSQL local; avanza 4.8 y 8.7. Progreso 44/64, 20 tareas abiertas.
Continuación de sincronización: [resolución y diario de conflictos](reports/verification-sync-conflicts-2026-09-08.md). Cierra 7.4 como componente local probado, sin activar sync. Progreso 45/64, 19 tareas abiertas.
Continuación de dispositivos: [transporte, identidad y revocación](reports/verification-sync-devices-2026-09-08.md). Cierra 7.5 en código main/IPC/UI y avanza 7.3/7.6, sin despliegue ni transferencia de datos. Progreso 46/64, 18 tareas abiertas.
Las compuertas de cierre permanecen abiertas porque aún falta implementar y
verificar todas las fases del cambio.

Corte de cinco cierres: [verificación del 2026-09-09](reports/verification-five-task-cut-2026-09-09.md).
Se cierran 5.5, 6.6, 7.3, 7.6 y 8.5: **51/64 completas, 13 abiertas**.
La evidencia histórica anterior se conserva; el reporte de este corte prevalece
para el estado actual de esos cinco bloques y sus límites de despliegue.

Continuación: [recuperación de bóveda dañada e integridad de extensiones](reports/verification-vault-recovery-extension-integrity-2026-09-09.md).
Avanza 8.7 y 5.7 sin cerrarlas: se conservan **51/64 completas y 13 abiertas**.

Continuación: [selección de pestañas y fuentes citables](reports/verification-tab-sources-2026-09-09.md).
Cierra 6.3: **52/64 completas y 12 abiertas**. La evidencia es automatizada;
no implica despliegue, smoke del instalador ni cierre de cancelación end-to-end.

Continuación: [detención de tareas visuales](reports/verification-cu-cancellation-2026-09-09.md).
Avanza 6.4 sin cerrarla: registro/aborto CU desde apertura hasta SDK y limpieza
de cola. Se conservan **52/64 completas y 12 abiertas**; pausa y toma de control
completa siguen pendientes.

Continuación: [atajos de lectura reutilizables](reports/verification-agent-shortcuts-2026-09-09.md).
Cierra 6.7: **53/64 completas y 11 abiertas**. Biblioteca y análisis de fragmentos
con permisos cerrados; no automatización de acciones ni activación de flags.

- [x] 9.1 Actualizar arquitectura, IPC, seguridad, parámetros, requisitos, historias, trazabilidad y operación. Se actualizaron arquitectura, límites, contrato IPC y reportes de transferencia/privacidad.
- [x] 9.2 Ejecutar pruebas main/renderer focalizadas por fase y registrar evidencia. Regresión de este corte y fases nativas registradas en el reporte del 2026-09-09. La suite global no está acreditada ni equivale a producción; no confundir inventario de archivos con casos ejecutados.
- [x] 9.3 Ejecutar typecheck, lint de cambios, harness y validaciones documentales. Todos aprobados en el corte del 2026-09-13, tras retirar la declaración sin uso de WhatsApp. Lint incremental sobre 20 archivos TypeScript más ESLint explícito de los verificadores MJS; sin deuda nueva.
- [x] 9.4 Ejecutar `npm run verify:pr` y separar fallos preexistentes de regresiones. Compuerta completa aprobada el 2026-09-13, incluida la suite general de 3427 pruebas en 317 archivos. La supuesta discrepancia SQL era únicamente CRLF y se corrigió el comparador sin modificar la migración; se corrigió además el generador WhatsApp que escribía HTML donde el contrato requería deck.json.
- [ ] 9.5 Ejecutar smoke manual de navegación, descarga, perfiles, privacidad, agente y restauración en Windows. Smoke focalizado automatizado sobre Electron 43.4.0 real ejecutado. Compilación y EXE de prueba aprobados sin .env/firma/publicación mediante installer:smoke:win (2026-09-13). Runtime Python preparado, ambos sidecars comprobados incluso dentro del paquete y 35 pruebas Python aprobadas; bienvenida personalizada revisada en vista nativa sin instalar. Siguen pendientes instalación/actualización/desinstalación completas, arranque con cuentas, flujo UI/IPC de perfiles, privacidad/agente y aceptación Windows Hello. Antes del rollout de sync: despliegue autorizado y pruebas Lia Auth/RLS/revocación con dos equipos reales; los fixtures HTTP locales no satisfacen esa condición.
- [x] 9.6 Ejecutar revisión adversarial de permisos, secretos, estados parciales, sync, borrado y rollback. Se conserva evidencia de bóveda/observador/SQL/conflictos. Dispositivos: control humano→agente→humano invalida consentimientos; revocación concurrente no publica registro activo; cancelación, quotas, 403, cuerpo bloqueado, errores redactados, sesión/exp y frames se cubren con pruebas negativas.
- [x] 9.7 Documentar riesgo residual, flags de rollback y compatibilidad de Electron. Se mantienen límites explícitos para OS auth/passkeys, perfiles privados, sync remoto, proveedor enterprise y smoke empaquetado; Electron estable 43.4.0.
