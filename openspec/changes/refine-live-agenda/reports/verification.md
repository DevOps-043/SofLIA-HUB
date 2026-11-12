# Verificación de la agenda de sesiones

Fecha: 2026-11-11. Estado: implementación local aplicada a Hub y Learning;
publicación y migración remotas pendientes.

## Resultado y alcance

La agenda reemplaza ilustración orbital, hero sobredimensionado y mensajes
promocionales por cabecera compacta, próxima sesión y lista de siguientes.
Conserva datos, temas y navegación al aula. La carga está separada de la vista
en `useLearningAgenda`, con política visual pura y tarjetas reutilizables.

Mi agenda muestra próximas asignadas. Organización/Clases que imparto e Historial
dependen del permiso académico confirmado. El rol global distingue la etiqueta
de administrador de plataforma sin conceder permisos nuevos ni suplantar la
membresía activa. El historial no abre medios; la programación y gestión siguen
en el panel existente de Learning, mediante una acción explícita y su propia
sesión web. Así no se duplican formularios, mutaciones ni reglas académicas.

La cabecera de capacidades negocia el contrato ampliado sin romper consumidores
v1 estrictos. Main construye el destino desde el origen configurado y el slug
validado. La URL no procede de metadatos Zoom ni lleva tokens. La vista limita
detalles a sesiones presentes en su catálogo.

## Evidencia ejecutada

| Comando o verificación | Resultado |
|---|---|
| Hub: suite focalizada de LearningSessions, catálogo main, wrapper, handler y preload | 43 pruebas aprobadas en el directorio activo final |
| Hub: `npm test` en worktree | 527 archivos aprobados, 2 omitidos; 6001 pruebas aprobadas, 5 omitidas; 266.69 s |
| Learning: módulo live completo y ruta auth/live/catalog | 22 archivos, 149 pruebas aprobadas |
| Hub: `npm run typecheck` | Aprobado |
| Learning: `tsc --noEmit -p tsconfig.typecheck.live-workspace.json` | Aprobado |
| Learning: typecheck focalizado de la ruta catálogo y contexto, con configuración temporal que extiende tsconfig.typecheck.app.json | Aprobado |
| ESLint de los componentes, modelos, contrato, servicio, pruebas y fixtures propios | Aprobado, sin advertencias |
| AppContent: comparación de lint con HEAD | 2 incidencias previas, 2 actuales, cero regresiones |
| `node test/manual/live-agenda/verify.mjs` | 11 comprobaciones de Chromium aprobadas, sin errores de renderer |
| `npm run docs:check` y `npm run docs:system:check` | Aprobados |
| `npx openspec validate refine-live-agenda --strict --no-interactive` | Aprobado |
| `git diff --check` en ambos repositorios | Aprobado |

La suite completa precede los últimos casos de regresión de permisos/organización
y sobretiempo en vivo. Esos ajustes se verificaron después mediante las 43 pruebas
focalizadas finales de Hub y las 149 del módulo Learning; no se atribuye al primer
comando completo un conteo que no ejecutó.

Las comprobaciones visuales cubren administración, docencia, alumno sin controles
de gestión, historial sin ingreso al aula, ruta segura de detalles, etiqueta de
administrador de plataforma, 390 px sin desbordamiento, vacío, error recuperable,
foco por teclado y ausencia de errores JavaScript. Las capturas proceden de la
fixture explícita de datos ficticios, sin cuentas reales ni conexión multimedia.

## Revisión adversarial y correcciones

- Solicitar historial como alumno o sin negociación se deniega antes de consultar.
- Cambiar organización/vista/página invalida respuestas anteriores. Quitar una
  organización elimina permisos retenidos, incluso ante colisiones con etiquetas
  de vacío. Revocar capacidades durante la carga devuelve a la agenda personal.
- La migración aplica el filtro de programadas vencidas antes de total y offset.
  Se ejecutó dos veces en PGlite; conserva firma/grants y no modifica sesiones.
- Se probaron 21 registros vencidos y dos futuros: los vencidos no desplazan la
  siguiente página. Instructor ve clases propias, administrador las del ámbito,
  otra organización queda aislada y authenticated no puede ejecutar el RPC.
- Una clase todavía en vivo no desaparece al superar su duración estimada ni se
  mueve a historial por inferencia local. Solo el estado académico la cierra.
- Si un servidor anterior devuelve programaciones vencidas, Hub las oculta sin
  inventar un total global corregido. No usa una etiqueta de rol como permiso.
- Se rechazan URLs de gestión suministradas por el proveedor, rutas de otra
  organización, credenciales en URL y detalles de sesiones ajenas al catálogo.
- El temporizador apunta a un único vencimiento; no hay polling continuo. La
  prueba avanza el reloj y confirma que no aparecen consultas periódicas.

## Deuda reducida y excepciones previas

Se separaron consulta/política/presentación y se retiraron estilos decorativos y
reglas duplicadas de viewport. Las fixtures usan fechas relativas y la prueba
bearer de Learning vuelve a respetar el formato JWT vigente. El inventario se
actualizó con `npm run docs:inventory:sync`, de 701 a 703 archivos, sin editar
manualmente cifras ni ampliar un baseline de lint. No se añadieron dependencias.

`npm run verify:pr` pasó adaptadores, arnés, cadena de suministro, documentación,
semilla, OpenSpec, pruebas de calidad y typecheck. Se detuvo en `lint:changed`:
9 errores y una advertencia preexistentes en los cambios locales de AppModals,
DeleteFolderModal y useAppViewHandlers-deleteFolder. No se modificó la gestión
de carpetas para ocultar ese bloqueo. AppContent conserva dos incidencias de
hooks existentes en HEAD, comprobadas sin regresiones. La compuerta general no
se declara aprobada.

## Entrega, activación y reversión

Hub se trabajó en `.worktrees/refine-live-agenda`, rama
`codex/refine-live-agenda`, conservando la línea base local y copiando únicamente
los archivos propios al directorio activo tras comprobar hashes. Learning quedó
en la rama `codex/refine-hub-live-agenda`. Para publicar, se creó el worktree
Learning `.worktrees/publish-hub-agenda` desde `origin/main` (`bef860df`),
sin arrastrar los dos commits locales ajenos. El commit propio `1af44d5` quedó
integrado mediante [PR 24](https://github.com/DevOps-043/SofLIA-Learning/pull/24)
en `de1f46a211b2445ddca3bb6be388687b748f61d6`.

La fuente SQL canónica vive en el repositorio Learning:
`supabase/migrations/20261111110000_live_catalog_session_periods.sql`.
Orden de activación: aplicar migración SOFIA Learning, publicar endpoint Learning
y distribuir/reiniciar Hub. La migración ya se aplicó en la rama de producción
del proyecto `SofLIA - Learning`, ref `mrqnnmuckznvukjvfkly`, mediante el editor
SQL autenticado. También quedó registrada como `20261111110000` en
`supabase_migrations.schema_migrations`, con el SQL canónico y reversión.
El MD5 del archivo normalizado a LF coincide con el registro remoto:
`79472e7a34c92a34860ca29ec6088e19`. Se comprobó igualdad exacta del cuerpo de
la función con el archivo versionado.

Las 3 sesiones de producción conservaron cantidad y huella de ID/estado/fecha
(`059b8e0e4cbd4dae63f021d00d228bfa`). No hay sesiones próximas; las 3 están
vencidas. El RPC real devuelve 2 y 1 en el historial de sus respectivos
instructores. Conserva SECURITY INVOKER; service_role puede ejecutar y
anon/authenticated no. La definición anterior se guardó en
[rollback-live-catalog-production.sql](rollback-live-catalog-production.sql).
La comprobación quedó en
[migration-production-results.txt](migration-production-results.txt).

Sobre la base actual de producción aprobaron 188 pruebas en 29 archivos, el
typecheck focalizado, ESLint y diff check. La preview Netlify
`6af4aab2647a97628c121fb1` terminó correctamente. Las tres comprobaciones de
tipos de GitHub, gitleaks y licencias aprobaron. Los controles generales de
auditoría npm y calidad crítica fallan también en la base: las dependencias no
cambiaron y las 5 rutas sin validación detectadas entre 572 rutas son idénticas
a origin/main. No se desactivaron controles ni se ampliaron baselines.

El [despliegue de producción](https://app.netlify.com/projects/soflia-learning/deploys/6af4adb20c417c5f0e39bd22)
`6af4adb20c417c5f0e39bd22`, desde main `de1f46a`, terminó publicado en
[soflia.ai](https://soflia.ai) el 11 de noviembre de 2026 a las 12:07,
America/Mexico_City. Netlify confirmó 14 funciones, una función edge,
3 redirecciones y 8 reglas de cabeceras; tiempo total 4m 24s. Evidencia:
[learning-production-published.jpg](learning-production-published.jpg) y
[migration-production.jpg](migration-production.jpg).

El endpoint público POST `/api/auth/live/catalog`, sin credenciales y con
negociación de capacidades, respondió 401 con `Inicia sesión en Soflia Hub`.
Después de que el usuario autenticara Hub, Actualizar mostró la etiqueta
Administración de plataforma, Organización, Historial y Gestionar en Learning.
Al abrir Historial en la cuenta real aparecieron las dos sesiones de las
capturas originales: Prueba Video SDK del 10 de noviembre y Revisión del panel
de sesiones síncronas del 11 de octubre. Ambas indican Sin cierre registrado,
con sus fechas originales. No se ingresó al aula ni se cambiaron estados o
fechas. La agenda próxima queda vacía porque no hay nuevas sesiones futuras.

Revertir los archivos de Hub y el endpoint restaura la presentación anterior.
Restaurar la definición de `live_catalog` de la migración
`20261010173000_live_hub_desktop.sql` revierte el filtro sin borrar historia.
La navegación de gestión puede requerir iniciar sesión en Learning dentro del
navegador; Hub no copia credenciales ni suplanta esa autenticación. No se probó
ingreso multimedia, empaquetado ni release del cliente de escritorio en esta tarea.
