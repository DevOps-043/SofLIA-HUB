# Evidencia de conexiones y streaming

Fecha: 2026-11-17. Misma rama `codex/optimize-build-runtime`; cambios previos preservados.

## Diagnóstico confirmado

- SDK Baileys y callbacks de mensajes/conexión se importaban estáticamente al cargar WhatsAppService. El build previo contenía un chunk whatsapp-service de 4666,25 kB. Se separa runtime y se difiere también el descargador heredado de documentos; no se retira ninguna ruta.
- Conexiones concurrentes podían atravesar los mismos await sin compartir preparación; no había invalidación de preparación al desconectar. Ahora los intentos se comparten y se revalidan por identidad/revisión.
- Reintentos tenían setTimeout sin registro/cancelación y sin catch. Se detectó además la carrera entre vencer el timer y ejecutar su microtarea; la cancelación se valida también ahí.
- Callbacks connection.update/creds.update podían rechazar sin dueño; socket retirado con service.sock null no se consideraba sustituido. Se contienen errores y se evitan publicaciones antiguas; el estado de desconexión se notifica incluso si falla la limpieza local.
- La resolución de principal en recepción de mensajes podía rechazar sin catch fuera del bloque de descarga de medios; el listener async dejaba un rechazo global. Los lotes de mensajes/llamadas ahora aíslan errores por elemento conservando autorización y continuidad del resto. Dos casos nuevos de mensajes y uno de llamadas aprobados, incluido rechazo remoto seguido de mensaje válido.
- Chat publicaba mensajes y actividad por cada fragmento. Ahora conserva todos los fragmentos y agrupa sólo publicaciones; bootstrap contiene fallos y ajustes tardíos.

## Pruebas dirigidas

- Primera pasada amplia: un caso que esperaba reconexión síncrona falló al diferirse a microtarea y dejó timers simulados en otros casos. Se corrigió la espera asíncrona y el cleanup de servicios/timers de la fixture, manteniendo las comprobaciones. La repetición amplia aprobó 28 archivos/303 pruebas antes del último caso adicional de error de limpieza.
- Última selección de regresiones: cinco archivos/66 pruebas aprobadas. Casos: import sin SDK, autorización denegada, intento compartido, revocación durante filesystem/versión, reemplazo de sesión con nuevo intento pendiente, reintento tras fallo, logout fallido, timers cancelados y errores de eventos/credenciales/limpieza.
- Fixture de streaming con 1000 fragmentos y reloj fijo: cuatro publicaciones totales (placeholder, primera muestra, vaciado, resultado), con texto completo, fuentes e imágenes intactos; tres fases de avatar. Es una ráfaga sintética, no una promesa porcentual de CPU/RAM total. Stop conserva texto acumulado.
- Bootstrap: resultado antiguo ignorado tras cambio de usuario; dependencia fallida no deja rechazo global.

## Verificación final

Build del estado final, con tipos y todos los runtimes: aprobado después de los ajustes de listeners. El chunk de entrada WhatsApp pasó de 4666,25 kB a 9,73 kB, conservando el SDK en un chunk diferido connection-runtime de aproximadamente 4656 kB; no es reducción del tamaño total ni una medida de RAM global.

Smoke nativo de importación: Electron real, perfil temporal independiente, sin BrowserWindow, cuentas ni conexiones. Carga del runtime compilado aprobada; export openWhatsAppConnection disponible. Primera muestra: 4284,65 ms y 88,46 MiB de RSS. Repetición tras build final: 283,08 ms y 91,20 MiB de RSS. La variación por caché/carga muestra por qué no se afirma mejora global a partir de esas muestras. Sin baseline comparable ni promesa de arranque total. Script de QA temporal bajo tmp/whatsapp-import-smoke.cjs, outputs generados no versionados.

Smoke complementario del servicio compilado: importar WhatsAppService y construirlo en otro perfil temporal aprobó la aserción de que ningún módulo connection-runtime aparece en require.cache. Muestra: 329,57 ms y 66,10 MiB de RSS. Son procesos/escenarios aislados, no RAM total del Hub ni un benchmark controlado de la aplicación. Script temporal tmp/whatsapp-service-import-smoke.cjs.

La primera compuerta integral de esta etapa se detuvo intencionalmente al incorporar los últimos casos de recepción; no se presenta como aprobada. La repetición sobre el estado final aprobó `npm run verify:pr` completo con código cero, sin reducir cobertura ni omitir herramientas:

- Adaptadores, arnés, suministro, integridad CI, runtime estable, documentación, semilla y OpenSpec: aprobados.
- Tooling: 66 pruebas aprobadas. Contratos Python: 33 aprobados usando Python 3.12.11 temporal con SOFLIA_TEST_PYTHON sólo por proceso.
- Typecheck aprobado y lint de 65 archivos sin deuda nueva.
- Suite global: 648 archivos aprobados y dos omitidos; 7605 pruebas aprobadas y cinco omitidas. Duración: 457,58 s.
- Cobertura validada en 2743 fuentes productivas: líneas 63,28%, sentencias 61,45%, funciones 57,99%, ramas 54,83%.

Los resultados verifican también las dos etapas anteriores conservadas en el worktree. Las últimas pruebas focalizadas de mensajes/llamadas aprobaron 51 casos en dos archivos. No se generó ni publicó instalador.

## Revisión adversarial y límites

Se revisaron logout durante preparación, A→B con finalización antigua, reintento simultáneo, timer vencido aún cancelable, socket viejo sin reemplazo, persistencia fallida, callback de credenciales retirado, stop/turno superado y salida íntegra. Revisión local; sin archivado.

El SDK permanece en caché tras usarlo. No se cancela físicamente IO/red ya iniciado, pero sus resultados revocados no crean sockets. Durante una pausa del proveedor, texto agrupado restante puede esperar al siguiente fragmento o al cierre del stream; no hay timer nuevo ni retraso artificial del resultado final. No hay dumps para atribuir los cierres reportados; no se garantiza ausencia absoluta de crashes.

Sin conexiones/envíos reales, cambios de secretos, migraciones o publicación. Reversión por diff de esta etapa conservando las dos anteriores.

La [continuación de trabajo de fondo y memoria](../../bound-background-work-and-memory/reports/verification.md) volvió a validar el estado acumulado con build y verify:pr completos aprobados, 7625 pruebas globales aprobadas.
