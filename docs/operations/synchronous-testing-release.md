# Entrega del aula síncrona para pruebas

Fecha: 2026-11-05. Estado: ramas de pruebas publicadas en los tres repositorios, verificaciones de producto aprobadas e instalador Windows de pruebas construido y verificado. Despliegue web y piloto audiovisual pendientes.

## Código y orden de publicación

La rama coordinada es codex/complete-synchronous-system en SofLIA-HUB, SofLIA-Learning y courseforge. Publicar primero Learning compatible con participación negociada y el endpoint interno de preparación; después Engine y Hub. Evitar un pool mixto de backends Learning antiguos/nuevos tras la primera escritura que amplíe el estado de estudio. Las ramas están destinadas a revisión y pruebas; no mover main ni reemplazar un despliegue productivo automáticamente.

Ramas publicadas: [Hub](https://github.com/DevOps-043/SofLIA-HUB/tree/codex/complete-synchronous-system), [Learning](https://github.com/DevOps-043/SofLIA-Learning/tree/codex/complete-synchronous-system) y [Engine](https://github.com/DevOps-043/courseforge/tree/codex/complete-synchronous-system). La publicación Git se confirmó mediante push; la existencia de un despliegue o PR no se deduce de ella.

Learning usa su netlify.toml y scripts/netlify-build.sh. Engine usa netlify.toml con captura del origen inmutable del despliegue antes del build, para que los jobs internos correspondan a la misma versión. No sustituir ese comando por next build directo en Netlify. La instalación Desktop necesita el paquete generado desde la misma rama Hub.

Para habilitar el acceso del equipo, desplegar la rama coordinada como entorno de pruebas de ambos sitios Netlify, conservando sus comandos versionados. Registrar la URL y el SHA efectivo de cada deploy; después comprobar la conexión Engine → Learning con una sesión programada autorizada. En esta sesión no hay conexión Netlify ni navegador habilitado para realizar ese paso.

## Instalador Windows disponible

Candidato: 0.9.9-sync.20261105, Windows x64, construido desde Hub 5a0e75d2. Archivo local: release/synchronous-qa-20261105-r2/Soflia-Hub-Windows-0.9.9-sync.20261105-Setup.exe. Tamaño: 597809249 bytes. SHA-256: a3cdd61d81407b8cb92fe124fa5246ac0709368328cbcb53e358792f66cdb187.

El [manifiesto de verificación](../../openspec/changes/complete-synchronous-system/reports/windows-testing-package.json) registra cabecera PE sin firma embebida, versión, hash del ASAR, 43 dependencias, entradas de la aplicación, ausencia de archivos de entorno e instrucciones de desarrollo, preservación del contexto runtime de reuniones y validación de Python/ambos sidecars. No se ejecutó el instalador ni se publicó el binario en un servicio de descargas; el archivo local puede compartirse con el equipo conservando su hash.

## Base y configuración

Learning principal mrqnnmuckznvukjvfkly ya recibió Video SDK y participación con versiones remotas 20261103184110 y 20261103184120. Engine emsjctbdevufloxntjll recibió su migración de autoría por ejecución manual del usuario; el postflight aportado confirmó tablas, permisos, trigger y políticas. La consulta posterior del historial no devolvió filas: ejecutar la reparación revisada del repositorio Engine y conservar la fila final antes de db push. No repetir CREATE TABLE ni ejecutar todas las migraciones históricas.

La reparación acotada de Engine está en openspec/changes/complete-live-preparation-delivery/reports/engine-migration-history-repair.sql. Ejecutarla en SQL Editor del proyecto Engine y comprobar que devuelve version=20261026160000 y name=synchronous_course_delivery. Sus precondiciones se detienen ante permisos o estructura incompatibles; únicamente registra el historial de la migración ya aplicada.

Engine requiere SYNCHRONOUS_COURSES_ENABLED=true para mostrar el flujo; habilita todas las organizaciones manteniendo los permisos por curso. SOFLIA_API_URL y SOFLIA_API_KEY pertenecen al servidor Engine; Learning verifica su COURSEFORGE_API_KEY. La igualdad/validez de estas credenciales debe comprobarse en el entorno administrado sin imprimir valores. Una variable presente no acredita conectividad ni permisos académicos.

Mantener Meeting por defecto hasta aprobar la prueba de Video. La configuración Video, privacidad de grabación, capacidad contratada y worker persistente siguen los documentos operativos de Learning docs/live-video-sdk.md y docs/live-recordings.md. El worker no se sustituye por una función efímera. No aprobar privacidad, cuotas, consumo ni acceso mediante valores de prueba.

## Recorrido mínimo del equipo

Instalar el candidato en un equipo o usuario de QA con Hub cerrado. Usa la identidad de instalación y el perfil habituales de Hub; no crea una instalación paralela aislada. El paquete de pruebas se construye sin feed de actualización para conservar su versión durante la evaluación. Volver a una versión distribuida requiere reinstalar el paquete estable.

| Paso | Actor | Resultado a comprobar |
| --- | --- | --- |
| Preparación | Revisor Engine | Curso síncrono/híbrido con materiales aprobados; destino pertenece a su organización y curso. |
| Entrega | Instructor autorizado | Learning confirma la revisión; Hub muestra láminas/consignas sin respuestas ni notas privadas. |
| Compatibilidad | Cliente anterior y actual | Lectura compatible; evitar servidores antiguos después de ampliar el estado. |
| Participación | Alumno asignado | Chat, pregunta y reacción; cadencia devuelve espera, duplicado no publica dos veces. |
| Aislamiento | Otra organización y permiso retirado | Acceso y entrega rechazados sin sobrescribir preparación. |
| Programa | Instructor | Escena, vídeo y audio, cámara explícita, rótulo; cancelación libera captura; reapertura recupera medios propios. |
| Salas Video | Instructor y alumnos | Asignación por identidad firmada, visita y reconexión sin confundir estado académico con traslado audiovisual. |
| Archivo | Operación | Grabación cloud, recuperación con Hub cerrado, transferencia privada y reproducción autorizada. |

Registrar URL real del despliegue, SHA desplegado, versión del Hub, escenario, resultado esperado/observado e ID de error seguro. No adjuntar tokens, contraseñas, URLs firmadas ni datos personales de alumnos. Para pruebas iniciales usar cuentas y cursos de QA previamente autorizados.

## Recuperación y límites

Retirar operaciones nuevas de forma coordinada, conservar tablas, revisiones, archivos y worker necesario para aulas/grabaciones pendientes. El rollback de una función no transforma JSON ampliado a legacy. Volver al proveedor Meeting solo afecta nuevas aulas; no borrar las credenciales de las Video existentes.

Las regresiones locales no certifican micrófono/cámara físicos, cuenta Zoom, simultaneidad, facturación ni captura cloud. La aceptación del piloto requiere registrar esos resultados. Publicar una rama en GitHub no publica por sí mismo un sitio o instalador.
