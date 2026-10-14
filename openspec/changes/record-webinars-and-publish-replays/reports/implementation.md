# Implementación y revisión de grabaciones

Fecha local: 2026-10-13. Estado: código implementado y validado localmente;
activación, cuenta real y prueba audiovisual externa pendientes.

## Alcance entregado

Anfitriones centrales administrados por Soflia, sin vinculación/licencia individual
del instructor. Automático cloud y readback en reuniones/webinars; protección de
reservas solapadas e ingreso mientras el anfitrión atiende otro evento.
Ingreso SDK con correo derivado en servidor, ZAK central y rol firmado.

Cinco migraciones aditivas SOFIA en el checkout Learning:
20261013180000 live_recordings; 180100 ingest; 180200 file_commit;
180300 retention; 180400 recovery. Archivo privado, RLS/tablas/RPC service-only,
barrera restrictiva de Storage, idempotencia, concesiones, cuota y ledger de purga.

Webhook existente firmado y acotado; UUID de ejecución, correlación de cuenta/host,
conservación independiente del cierre y trabajo pendiente antes del ACK.
Worker Node duradero, límites de concurrencia, cancelación, timeout, reintento,
Range/ETag, FFprobe, SHA-256 y multipart S3 oficial. Checkpoint y lease de
reconciliación, sin avanzar ventana si expira el token de página.

Estado SDK validado en Hub, aviso a participantes, preferencia de repetición,
panel/reproductor Learning, edición/segmentos, intención vigente, retiro con revisión,
URLs efímeras y revalidación tras firmar. Captura y publicación son independientes.
Ensayo, cobertura incierta o contenido adicional exigen revisión específica.
No se añadieron canales IPC genéricos ni herramientas para agentes runtime.

## Verificación registrada

- Learning: TypeScript dirigido de grabaciones, scripts y dependencias: exitoso.
- Learning: suite completa de sesiones: 117 pruebas en 17 archivos, exitosas;
  después se añadieron y pasaron 3 casos específicos de correo SDK en webinars.
- SQL/PGlite: cinco migraciones aplicadas dos veces; permisos, política general
  permisiva de Storage, idempotencia, publicación/retiro, segmentos tardíos,
  concesión ajena, cuota, hold y reserva central.
- Acceso: edición privada/deshabilitada/moderada, membresía retirada, retiro
  mientras se firma y correspondencia de path en concesiones.
- Transferencia: destinos SSRF, redirects sin fuga de OAuth, Range/ETag,
  tamaños, cuerpo firmado acotado, UUID especial, cobertura y layouts.
- Hub: typecheck y TypeScript del SDK: exitosos; bundle aislado del SDK construido.
- Hub: pruebas dirigidas de acceso HTTP, CSP, producción, grabación y cambio de rol:
  exitosas. La primera suite completa detectó dos fixtures con suscriptor único;
  se corrigió el mock para representar los listeners múltiples del preload.
- Arnés, adaptadores, supply-chain, OpenSpec, enlaces e inventario documental:
  exitosos en la ejecución previa al cierre.

La compuerta completa de Hub terminó satisfactoriamente: 4353 pruebas pasadas,
1 omitida; typecheck, lint, arnés, supply-chain, OpenSpec y documentación verdes.
Learning terminó con 121 pruebas de sesiones pasadas en 19 archivos y tipos/lint
dirigidos exitosos. La caché web se separa por identidad y sus peticiones incluyen
actor esperado; una respuesta para otra cuenta se rechaza y desmonta el vídeo. Ninguna prueba local acredita captura real de Zoom ni una subida
real de webinar al Storage contratado. No se abrieron ventanas nativas de prueba.

## Comparación contra baseline

Learning type-check:core pasó. type-check:app tiene errores preexistentes:
303 diagnósticos en el checkout principal previo frente a 301 en el checkout
de grabaciones, sin diagnósticos añadidos. No se amplió un baseline para ocultarlos.
El análisis dirigido del cambio es verde; no se declara verde el gate general.

Auditoría npm de producción: 61 hallazgos previos, 59 actuales, sin paquete
vulnerable añadido ni hallazgo en @aws-sdk/@smithy. Persisten 1 crítico,
15 altos, 42 moderados y 1 bajo ajenos al nuevo feature; no se declara un
repositorio libre de vulnerabilidades. Los clientes S3 oficiales 3.1151.0 se fijan
exactamente, licencia Apache-2.0, y permanecen solo en servidor.

## Revisión adversarial local

Hipótesis refutadas con cambios y pruebas:

1. Una pausa puede seguir mostrándose como Grabando: estado SDK observado prevalece.
2. Un worker vencido puede afectar al nuevo dueño: fail/commit/finish cercados por lease.
3. Un callback o segmento tardío puede republicar: revisión de publicación y retiro
   transaccionales; un segmento nuevo invalida edición y exige una decisión nueva.
4. Un callback de cierre anterior al vídeo pierde su límite: cierre persistido por sesión.
5. Una política general de Storage puede exponer privados: política restrictiva probada.
6. Una membresía retirada durante la firma conserva grant: segunda autorización y
   lectura de publicación/política; no se entrega URL si cambia el permiso.
7. Una página expirada deja la importación permanentemente bloqueada: conserva ventana,
   reinicia token y cerca propietario de reconciliación.
8. Una grabación vieja, ensayo o intervalo adicional parece completo: cobertura
   conservadora y comprobación editorial; sin publicación por intención genérica.
9. Una respuesta perdida de commit borra una copia válida: ledger y reconciliación
   del file; no se elimina el objeto incierto desde el worker.
10. Cuota, GC o abandono pueden perder otra clase: keys por org/sesión/run/file/lease,
    cuota transaccional, hold y purga independiente del material del estudio.

Esta es revisión local, no se presenta como revisión independiente ni PoC.
No se archiva OpenSpec; las comprobaciones operativas quedan pendientes.

## Activación y reversión

Runbook del servidor: Learning/docs/live-recordings.md.
Runbook del cliente: [operación de grabaciones](../../../../docs/operations/webinar-recordings.md).
Privacidad Zoom y recuperación SDK sin aprobar; replay_enabled y
retention_approved comienzan false. SQL remoto aplicado con autorización el
14 de octubre de 2026; cuenta, worker y transferencia/reproducción real siguen
pendientes de activación y PoC.
No se leyeron ni copiaron secretos o archivos .env; no se ejecutaron purgas reales.

Reversión conservadora: deshabilitar nuevas repeticiones, detener worker de forma
controlada y conservar DB/ledger/bucket/archivos. No revertir borrando grabaciones.
Los cambios ajenos del estudio y de marca se preservan.

## Integración final

Se integraron 49 archivos del feature en el checkout principal de Learning y
29 archivos de implementación/especificación/documentación en Hub. No se
sobrescribieron archivos ajenos al manifiesto revisado. Dependencias instaladas
en Learning con scripts de instalación deshabilitados; sin ejecutar el worker real.

Comprobaciones posteriores: Learning 121 pruebas pasadas en 19 archivos,
tipos dirigidos exitosos; Hub typecheck exitoso, contratos sincronizados
con normalización LF/CRLF y enlaces válidos. Comandos --help de ambos scripts
exitosos sin operaciones remotas. Bundle SDK actualizado y compilado en
worktree de verificación. No se publicó release ni se reinició una llamada.

## Aplicación remota y preparación de Git — 2026-10-14

El usuario autorizó aplicar las migraciones desde Supabase abierto en Chrome.
Destino confirmado en UI: SofLIA - Learning, proyecto mrqnnmuckznvukjvfkly,
rama main PRODUCTION. El preflight confirmó las nueve tablas de dependencia,
live_workspace_authorize y el esquema private. No existían el bucket ni runs
de grabaciones. No se leyeron filas de usuarios ni credenciales.

Se ejecutaron las cinco migraciones enumeradas arriba, en orden, dentro de una
transacción común. Se reemplazaron únicamente sus envolturas BEGIN/COMMIT por
la transacción exterior, con lock_timeout de 10 s y statement_timeout de 120 s.
Las cinco versiones y sus cuerpos quedaron registrados en
supabase_migrations.schema_migrations en la misma transacción. No se registraron
versiones previas cuyo historial no acreditaba aplicación.

Verificación remota posterior, 2026-10-14 06:07:19 UTC:

- Cinco versiones e integridad de sus cuerpos: 5/5, comparación MD5 con LF normalizado.
- Diez tablas con RLS: 10/10; cero privilegios directos SELECT/INSERT/UPDATE/DELETE
  para anon y authenticated; 40/40 privilegios esperados para service_role.
- Diecisiete funciones invocables por el servicio: 17/17, sin SECURITY DEFINER
  ni EXECUTE para anon/authenticated. La función adicional hold_guard es un
  trigger privado, sin invocación directa concedida; su trigger está habilitado.
- Bucket live-recordings privado, MP4 y límite por objeto de 50 GiB; política
  restrictiva para ambos roles y protección ante purga comprobadas en catálogos.
- Cero políticas con replay_enabled o retention_approved activados.

Consulta y resultado conservados en el editor SQL de Supabase:
[verificación remota](https://supabase.com/dashboard/project/mrqnnmuckznvukjvfkly/sql/56092a3d-e04f-4fce-96e9-a62cfd0b9700).
Estas comprobaciones de esquema y permisos no acreditan la captura de vídeo,
transferencia S3, publicación ni despliegue del worker. No se ejecutaron purgas.

El error Git de la captura no se reprodujo en el checkout principal: el archivo
.agents/rules/soflia-harness.md existe y está versionado. git add de esa ruta
concluyó con código 0 y dejó su cambio en el índice (M en la primera columna).
La causa del estado anterior del editor no está confirmada. No se creó commit
ni se prepararon cambios ajenos a esa ruta. diff --cached --check sin incidencias;
harness:validate y docs:check pasaron.

## Consolidación Git para continuar — 2026-10-14

El usuario solicitó commits en ambos repositorios, Learning en main y Hub en
una sola rama de trabajo. Learning conserva el trabajo actual en af565278,
publicado en origin/main. Sus ramas codex de sesiones, acceso Hub, correcciones
Zoom y estudio ya son antecesoras de main; la rama local de grabaciones partía
de la misma base y no tenía commits exclusivos. No se incorporaron ramas
históricas ajenas ni actualizaciones automáticas de dependencias.

Hub conserva el contenido completo del checkout en f8d699b y consolida el
historial de marca (3387c5a), grabaciones (6a69df1) y apertura Linux (caacf8d)
en codex/live-studio-runtime. Los conflictos de marca/grabaciones eran versiones
anteriores de las mismas fuentes: se compararon contra el contenido integrado,
conservando validación de actor, contratos compartidos, escenas locales,
limpieza de captura y evidencia de migraciones. Esos dos merges mantienen
exactamente el árbol de f8d699b. La integración Linux conserva sus archivos
y recalcula el inventario documental: 597 archivos de prueba.

Se compararon también los archivos modificados de los worktrees de respaldo
con los checkouts principales, normalizando CRLF/LF: ninguna fuente de código
exclusiva quedó fuera. Las diferencias corresponden a documentación anterior
a la aplicación remota y al nuevo conteo de pruebas. Los respaldos se conservan.

Verificación de Learning repetida para esta entrega: 121 pruebas pasadas en
19 archivos live; tipos de tsconfig.recordings.json y ESLint de fuentes web
afectadas exitosos. La primera invocación de ESLint desde la raíz encontró
la configuración legacy; se repitió con el flat config vigente de apps/web.
No se modificó la configuración de lint ni se afirma un typecheck global limpio;
la línea base de errores de la aplicación consta en la verificación anterior.

La primera compuerta de Hub detectó tres pruebas de integración POSIX intentando
ejecutar scripts /bin/sh y permisos Linux en Windows, aunque simulaban platform.
Se limitó su ejecución al host Linux real; no se omitieron pruebas portables.
Las cinco suites dirigidas de apertura/verificación pasaron: 31 casos y tres
casos POSIX omitidos en este host. La captura nativa Linux requiere su runner.

Compuerta final npm run verify:pr exit 0: 4384 pruebas pasadas, cinco omitidas
en 432 archivos (430 aprobados y dos suites opt-in omitidas). Pasaron adaptadores,
arnés, suministro, documentación, semilla, 66 cambios OpenSpec, typecheck y lint.
docs:check se repitió tras actualizar este reporte: 537 documentos válidos.
Se verificó ancestry de las tres ramas integradas y ausencia de conflictos
pendientes. Los checkouts principales quedan preparados para seguir en
Learning/main y Hub/codex/live-studio-runtime.

Punto de continuación: los cambios de grabación están guardados y las cinco
migraciones remotas verificadas. Falta configurar/verificar capacidad y privacidad
de la cuenta central, desplegar el worker duradero y ensayar captura,
importación y reproducción reales antes de activar publicaciones y retención.
Los cambios OpenSpec permanecen abiertos; esta consolidación no es un release.
