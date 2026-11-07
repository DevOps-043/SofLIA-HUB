# Verificación de privacidad de telemetría WhatsApp

Estado: implementada y verificada localmente; revisión independiente pendiente.
Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base Git: e166d250629e503cf12f69449fb6d66e569134c8. Sin commit/push ni mutación remota.

## Causa y resultado

El productor persistía toolSignature como JSON de argumentos y copiaba al
resumen mensajes, errores y IDs de sesión del proveedor. El store sólo limitaba
profundidad/entradas, sin minimizar contenido de tool; los registros antiguos
se devolvían sin proyección. Las excepciones del dispatcher/fallback podían
registrar objetos crudos y devolver sus mensajes. Un fallo síncrono del registro
posterior al efecto podía impedir devolver el resultado y agregar trace.

Ahora el productor y store comparten observación de campos permitidos: nombre
identificador acotado, estados cerrados, flags, contadores enteros, códigos de
error cerrados y UUID de correlación. Para kind:tool se omiten text/media y
metadata arbitraria; la metadata admite UUID/duración. La lectura legacy aplica
la misma proyección antes de buscar/devolver, preservando los bytes anteriores.
Los eventos no-tool y los identificadores de contacto mantienen su contrato.

Las firmas internas usan HMAC-SHA256 con clave aleatoria de 32 bytes por turno
en WeakMap. No se persisten firma, payload ni clave. Se conserva comparación de
argumentos/datos relevantes en memoria; contadores y flags distinguen avances.
Los UUID de error se excluyen de la firma para que otro ID del mismo fallo no
simule progreso. El resumen público/trace omite mensajes y errores libres.

Trace se actualiza antes de registrar history; fallos síncronos/asíncronos de
registro se aíslan y no cambian el resultado ni repiten efectos. Dispatcher,
fallback y guardas inesperadas devuelven mensaje fijo/código/ref y log saneado.
Fallar autorización impide ejecutar; una excepción de ejecución señala
uncertain/recoveryRequired porque no permite conocer su efecto. El cierre por
fallos repetidos deja de concatenar errores privados. Los resultados normales
de dominio que recibe el modelo conservan su contenido y flags.

## Evidencia ejecutada

| Verificación | Resultado |
|---|---|
| Baseline agente/ejecutor/feedback Gmail | 3 archivos, 74 pruebas aprobadas |
| Reproducción roja de historial | Dos fallos confirmados de persistencia/lectura privada; control conversacional aprobado |
| Suite dirigida revisada | 9 archivos, 148 pruebas aprobadas |
| Regresión de logger: servicio/llamadas/jailbreak/store/fallos | 5 archivos, 59 pruebas aprobadas después de completar el doble Pino |
| Typecheck renderer/main | Aprobado |
| Lint incremental | 139 archivos sin deuda nueva tras completar el fixture Pino |
| Inventario derivado | 629 archivos de prueba; 494 canales, sin canales/dependencias nuevos |
| Build aislado | Aprobado: 3306 fuentes y seis artefactos sin .env |
| npm run verify:pr | Aprobado: 4849 pruebas, 5 omitidas; 459 archivos aprobados y 2 omitidos; suite de 217,15 segundos |

Se añaden 43 casos entre cuatro suites nuevas y las regresiones de excepciones.
La compuerta también aprueba adaptadores, arnés, política de dependencias,
documentación/enlaces, semilla de skills, 79 elementos OpenSpec, cuatro pruebas
de tooling, tipos y lint. [Resumen estructurado](verification.json).

Se usan archivos JSONL temporales reales, errores y contenido ficticios; no se
inspeccionan perfiles, .env ni historiales reales. El productor se prueba con
ejecutor/transporte simulados; guardas de repetición y store son reales. El
dispatcher ejecuta sus guardas con confirmaciones y efectos simulados. El
primer caso de fallback apuntaba a una ruta atendida por otro handler/doble
dinámico heredado; se fijó la precondición para ejecutar el fallback real antes
de declarar esa prueba aprobada. No se modificaron reglas para esconder el fallo.

La primera compuerta completa falló en 53 casos de tres archivos y detectó un doble Pino incompleto en los fixtures
del servicio WhatsApp: sólo devolvía level y no exponía las funciones estáticas
y child del logger estructurado recién consumido por history. Se completó ese
doble y se comprobaron 59 pruebas dirigidas. La compuerta fallida se conserva
como evidencia; el resultado final procede de una ejecución nueva tras esa
corrección, aprobada. No cambió la implementación de producción ni sus artefactos.

Logs temporales: `%TEMP%/soflia-tool-telemetry-2026-10-22/` con baseline.log,
history-red.log, directed-reviewed.log, exceptions-final.log, typecheck-third.log,
lint-final.log, build-final.log, verify-pr-final.log (primer intento fallido) y
verify-pr-reviewed.log (compuerta final). Los reportes versionados
conservarán las cifras esenciales; los logs temporales pueden caducar.
[Resumen de build](build-summary.json) y [hashes de artefactos](build-artifacts.json).
Persisten advertencias de Vite, importaciones dinámicas y chunks grandes; no se
silencian ni se atribuye una mejora de rendimiento a la compilación.

## Autorrevisión adversarial

| Hipótesis intentada | Evidencia / corrección |
|---|---|
| Metadata/summary transportan secretos aunque el productor filtre | Store aplica el mismo campo permitido; pruebas de escritura y lectura/search con disco real y bytes legacy intactos |
| Payload se esconde en status, contadores o nombres | Estados cerrados, booleanos estrictos, enteros seguros/no negativos, identificadores acotados; entradas inválidas omitidas |
| Se pierde avance de lotes o se informa éxito al fallar | Conteos/flags preservados, resultado original idéntico al retornado y hadFailure sin texto privado |
| Fingerprints permiten correlación persistente/diccionario | Clave aleatoria por turno, HMAC sólo en trace; history recibe UUID/duración y no firma de argumentos |
| Otra correlación evita detectar el mismo error | Excluir correlationId de huella; caso negativo con dos referencias del mismo fallo |
| Fallar recordHistory vuelve a ejecutar la operación | Errores síncronos y Promise rechazada capturados después de trace; una ejecución y resultado intacto |
| Error de guarda permite una acción | Excepción de confirmación deniega ejecución y devuelve código guard; sigue la siguiente herramienta según su propia guarda |
| Fallback o dispatcher revela error/stack | Mensajes privados ficticios sustituidos por texto fijo/ref; logger no recibe objeto err ni argumentos |
| Cambiar política de observación modifica conversaciones | Evento no-tool, filtros y estadísticas conservados; no se altera su política de contenido |

Es autorrevisión; revisión independiente pendiente antes de archivar. No se
pretende que IDs de contacto o nombres legítimos de herramientas sean anónimos.

## Límites y reversión

- La proyección de lectura no cifra ni borra los bytes heredados. Los respaldos
  previos pueden conservar payload privado y necesitan gestión explícita aparte.
- Texto conversacional, teléfonos y eventos no-tool permanecen bajo la política
  existente. El historial completo no obtiene cifrado ni retención global.
- Respuestas normales elaboradas dentro de servicios pueden contener contenido
  necesario o errores propios; esta unidad no sanea cada dominio ni cambia su
  entrega funcional al modelo. Sólo las excepciones inesperadas de estas
  fronteras reciben error fijo.
- Huellas de turno no son claves de idempotencia, memoria durable ni garantía
  de privacidad frente a quien controle el proceso/cuenta del SO.
- Sin proveedor/WhatsApp reales, UI humana ni instalador. No se recalcula el
  índice global de deuda con cantidad de pruebas o líneas modificadas.

Revertir esta unidad conserva las ocho anteriores, pero reintroducir el filtro
antiguo puede restaurar la filtración. Preferir mantener la proyección del store
y corregir una regresión localizada. No se cambian archivos previos del usuario;
revertir código no elimina registros ya escritos ni revierte efectos remotos.
