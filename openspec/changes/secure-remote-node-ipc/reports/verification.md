# Verificación del lote 39

Fecha: 2026-10-26. Implementación integrada y verificación local aprobada.

Se cerraron los 13 canales Remote Node mediante fuente/identidad vigentes,
schemas y cuotas compartidos, confirmación nativa para acciones sensibles y
revisión de configuración antes de efectos. Se mantienen canales y datos válidos;
las herramientas renderer proyectan campos consumidos y validan sin any.

El cliente limita plazo a 60 s para consultas/acciones breves y 15 minutos para
la tarea de escritorio síncrona, y respuesta a 20 MiB reales; rechaza redirects,
libera lectura al cancelar y evita metadata tardía. Los errores HTTP/transporte
usan mensajes fijos. Después de admitir posibles efectos devuelve incertidumbre
sin retry. Actualizar host conserva su DTO exitoso y rechaza fallos con mensaje
fijo que comunica posible aplicación cuando corresponde.

Se corrigió la conservación del binding anterior al cambiar interfaz sin cambiar
puerto; la reconciliación del servidor se serializa hacia la última configuración.

## Evidencia dirigida

- IPC antes de la corrección: 35 fallos causales de fuente/sesión/HITL/entradas.
- Transporte antes de corregirlo: 4 fallos causales. El primer intento de IPC
  tuvo un error sintáctico en el test; se corrigió y se repitió antes de tocar
  el handler. No se presenta ese error de test como regresión del producto.
- Suite final dirigida: 177 aprobadas, cero fallos, diez archivos; 140 casos
  nuevos. Incluye las cuatro capas y consumidores anteriores.
- Los puertos de Electron, servicios/red y diálogos se sustituyen; el servicio
  real se comprueba con persistencia y binding sustituidos. Sin sockets, ventanas,
  cuentas, nodos ni herramientas nativas reales.

## Revisión adversarial propia

La primera compuerta y build pasaron. Una revisión adicional de host-routes
confirmó que la tarea espera finalizar antes de responder: se separó su plazo
de 15 minutos del de 60 s para consultas, con prueba de ambos límites. Se repiten
compuerta y build sobre las fuentes finales; el lint de los tres archivos
ajustados sigue en cero, igual que sus filas del análisis global previo.

Se intentaron refutar fuente/identidad para los 13 canales con sesión ausente,
ventana ajena, subframe y documento ajeno. Se cubrieron cancelación, plazo,
A/B/A, navegación/destrucción durante aprobación y secreto en lectura tardía.
Se probaron datos inválidos, campos extra, getters, puertos/URL/ID/tarea/comando
excesivos, preservación literal de comandos y redacción de tokens en revisión.

La revisión detectó dos casos adicionales corregidos: una respuesta adquirida
antes de cancelar debía liberar su body, y una URL heredada con credenciales no
debía llegar al diálogo. Se probaron revisión revocada, configuración cambiada,
capacidad futura, bytes reales frente a cabecera falsa, fetch que ignora señal,
incertidumbre tras envío y convergencia del binding con cambios concurrentes.

Revisión independiente pendiente; no archivar. La revisión propia no la sustituye.

## Resultado final

Las 14 etapas de verify:pr pasaron: 6227 pruebas Vitest aprobadas y 5 omitidas,
62 del tooling y 33 Python. Lint incremental revisó 499 archivos sin deuda nueva.
El análisis src/electron pasó de 1888 a 1878 errores, con 31 avisos y cero
fatales; producción de 1468 a 1458 errores y de 1295 a 1285 mensajes any.
No aumentó ninguna cuenta por archivo/regla/severidad frente a unidad 38.

Cobertura de las 2570 fuentes productivas: líneas 57.04 → 57.35%, sentencias
55.71 → 56.01%, funciones 51.82 → 52.24% y ramas 49.69 → 49.96%. Sin bajar
pisos ni ampliar exclusiones. La compilación aislada produjo seis artefactos;
no acredita instalador ni arranque. Las 3550 fuentes del manifiesto conservaron
hashes idénticos durante compuerta/build; sus 3530 fuentes copiables coinciden
con el sandbox y se preservó la eliminación previa ajena a esta unidad.

El delta es de 9 fuentes existentes y 8 nuevas. Respaldos de las existentes
coinciden con la unidad 38. Manifest/lock, dependencias, reglas de lint y política
de cobertura se conservaron. La mejora de seguridad/lint no se convierte
automáticamente en puntos del índice global ordinal; el último publicado sigue
en 40.88% tras la unidad 37.

Recibos: [compuerta](gate-summary.json), [build](build-summary.json),
[cobertura](coverage-evidence.json), [lint](lint-evidence.json),
[regresiones](regression-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json). La primera ejecución verde y sus manifiestos se
conservaron con prefijo initial en TEMP antes del ajuste de compatibilidad.

## Límites y reversión

El almacén sigue plano/global: no acredita ownership entre usuarios, cifrado,
RLS ni autorización de todos los canales del Hub. Otras APIs de automatización,
runtime main/WhatsApp y HTTP entrante mantienen guardas previas y deuda pendiente.
No garantiza saneamiento de secretos reflejados en datos arbitrarios de terceros.
El cierre del servidor puede esperar conexiones entrantes existentes; sus cuotas
y plazos requieren auditoría posterior. Cancelar no revierte un efecto ya enviado.

Respaldos relativos y logs en TEMP/soflia-remote-node-ipc-2026-10-26. Revertir sólo
el delta contra la unidad 38; conservar trabajo previo. Sin dependencias nuevas,
secretos/.env, SQL, acciones remotas, stage/commit/push ni despliegue.
