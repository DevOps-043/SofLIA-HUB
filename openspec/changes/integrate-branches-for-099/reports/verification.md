# Verificación de la integración 0.9.9

## Alcance y trazabilidad

Base de main: `61cbadfea1a157984d9f2f47e9a035ee0e2f6fac`. Se consultaron
las referencias remotas mediante `git fetch origin`, con checkout inicialmente
limpio. La integración se prepara en `codex/integrate-all-branches` y main se
actualiza por avance rápido después de verificarla. No se eliminan ramas ni se
reescribe el historial.

Se incorporan la evolución de sesiones y navegador (`4f59b0a`), Google Chat
(`8176983`), diagnóstico de cuentas (`df961e3`), multimodalidad (`8c735e2`)
y recursos (`c089873`). El [inventario](branch-inventory.md) registra cada extremo
consultado y su incorporación al historial.

Las catorce ramas AutoDev divergentes se reconcilian mediante `git merge -s ours --no-ff`
como merges históricos
que conservan el árbol vigente. Sus prototipos no se habilitan automáticamente.
La revisión independiente encontró estas razones para conservar la evolución
actual:

| Rama AutoDev | Decisión sobre el contenido antiguo |
|---|---|
| 2026-02-22T19-37 | No recuperar lectura de disco sin aislamiento, entorno heredado ni dependencias sustituidas. |
| 2026-02-22T20-44 | Conservar historial de incidencias; no incorporar enlace a repositorio anidado. |
| 2026-02-23T05-43 | No recuperar evaluación de código sin aislamiento ni memoria sin propiedad por usuario. |
| 2026-02-23T09-05 | No recuperar almacenes huérfanos ni un worker OCR ausente. |
| 2026-02-24T18-51-15--pyw2q | Adaptar la captura de accesibilidad a la ventana enfocada; conservar supervisión actual. |
| 2026-02-24T22-38-54--e7rc6 | No recuperar reinicio forzado de ramas, staging arbitrario ni carga dinámica insegura. |
| 2026-02-28T02-37-06--a3u89 | No recuperar políticas SQL permisivas ni flujos CRM incompletos. |
| 2026-03-02T05-11-07--tdpzz | Conservar navegador seguro actual; no recuperar comandos inyectables ni métricas incorrectas. |
| 2026-03-03T22-55-35--f4qxc | Conservar monitorización y respaldo vigentes; no recuperar utilidades huérfanas. |
| 2026-03-07T09-04-04--r5kpr | No recuperar herramientas sin consumidor ni contrato MCP incompatible. |
| 2026-03-07T21-53-20--zndkz | Inicialización vacía y cambios sin efecto funcional; historial conservado. |
| 2026-03-09T06-14-57--qgyxw | No recuperar exportaciones MCP que omiten la política vigente. |
| 2026-03-09T07-06-57--ij4pb | No recuperar bus duplicado, temporizadores sin cierre ni servicios sin consumidor. |
| 2026-03-09T09-05-56--5jwa0 | Adaptar fin del indicador de actualización; no recuperar conflictos literales, versión antigua ni GC inseguro. |

Los conflictos recientes se resuelven combinando las partes nuevas con los
controles de identidad, aprobación, cancelación, herramientas y recuperación
del chat vigentes. Se corrigen mocks duplicados y contadores de canales.

## Revisión adversarial

La revisión independiente intentó refutar la continuidad de autorización durante
capturas y subidas, la cancelación, la identidad tras esperas y la veracidad de
las notas de versión. Se corrigieron:

- Lecturas visuales que omitían autorización del sitio o podían mezclar pestañas,
  documentos y cuentas después de una espera.
- Muestreos sin cancelación del turno: ahora tienen petición identificada y
  cancelación IPC, además de invalidación al cambiar la sesión.
- Referencias de subidas compartidas entre sesiones: ahora tienen propiedad y
  generación, con comprobaciones después de las operaciones asíncronas.
- Resolución de medios calculada pero no aplicada a la petición del modelo; los
  lotes de herramientas conservan la menor resolución requerida.
- Ocultaciones temporales de gestores que congelaban vistas aún presentadas.
- Selección de audio y vídeo en un compositor que todavía usa lectura completa
  del archivo: se conserva el selector vigente hasta conectar la subida por flujo.

La revisión final no encontró bloqueantes adicionales. No se anuncian escucha
ambiental ni subida de archivos grandes como funciones terminadas. El aula se
describe como diseño local, sin transmisión de medios ni publicación de actividades.

## Evidencia

Compuerta final ejecutada con `HARNESS_BASE_REF=main npm run verify:pr` el
2026-10-11. Terminó correctamente sobre el código integrado y versión 0.9.9:

- Adaptadores, arnés, cadena de suministro y semilla de Skills: correctos.
- Documentación de sistema: 28 documentos, 150 IDs, 467 canales y 558 archivos
  de prueba inventariados. Enlaces: 463 documentos Markdown activos válidos.
- OpenSpec: 56 elementos válidos, cero fallos.
- Typecheck de renderer y main: correcto.
- Lint incremental: 371 archivos revisados, sin deuda nueva respecto a HEAD.
- Vitest: 392 archivos aprobados y uno omitido; 4.157 casos aprobados y uno
  omitido, sin fallos. Duración de la suite: 62,61 segundos.

Se repite `git fetch origin` al terminar: las 54 referencias de ramas remotas
siguen incorporadas al historial integrado. `git diff --check` no detecta errores.
Main local se actualizó por avance rápido hasta `4b38e55`, commit de preparación
de 0.9.9. La comprobación posterior incluye también todas las ramas locales:
ninguna referencia queda fuera de main. Se conserva la rama de integración.
Los cambios posteriores a esta compuerta se limitan al registro de evidencia y
la finalización de tareas; documentación y OpenSpec se validan otra vez antes
del cierre.

| Criterio | Evidencia automatizada |
|---|---|
| Sitio bloqueado, documento sensible y cambio de pestaña durante captura | `electron/__tests__/integrated-browser-service.test.ts` |
| Pausa, cancelación y ocultación temporal sin congelación | Suite del servicio y `src/__tests__/services/browser-vision-tools.test.ts` |
| Subframes rechazados, cuenta ajena y salida/reentrada durante subida | `electron/__tests__/media-input-handlers.test.ts` |
| Allowlist, wrapper y conteo de canales | Suites de handlers, preload y servicio renderer del navegador |
| Contenido multimodal y presupuestos de evidencia | `src/__tests__/services/multimodal-message-content.test.ts` |
| Actualización fallida sin indicador permanente | `src/__tests__/components/updater-hooks.test.tsx` |
| Accesibilidad limitada a la ventana enfocada | `electron/__tests__/monitoring-accessibility-focus.test.ts` |

Los primeros intentos detectaron dependencias locales ausentes, mocks duplicados,
inventarios de canales y pruebas desactualizados y enlaces a registros locales
no versionados. Se corrigieron y se repitieron las comprobaciones afectadas.
Dos ejecuciones simultáneas de pruebas compartían un directorio temporal del
navegador y produjeron errores de archivos; se finalizaron antes de repetirlas.
La prueba de documento sensible durante captura pasó al ejecutarla de forma aislada.
La suite completa detectó además que importar Recharts dentro de una prueba
consumía su límite temporal durante la transformación bajo carga. Se precarga
el módulo real mediante import estático en la suite, manteniendo componente,
aserción de accesibilidad y límite temporal. Sus tres casos focalizados pasaron.

## Límites y recuperación

No se ejecutan migraciones en bases remotas ni se modifican secretos o archivos
de entorno. Las migraciones y diagnósticos incorporados permanecen versionados
para su aplicación mediante el procedimiento de cada instancia.

No se firma, empaqueta, sube main ni publica un instalador. El push a main activa
el workflow de release, por lo que la integración queda local. No se verificaron
en esta tarea proveedores externos, una llamada real de Huddle ni una sesión
transmitida. La recuperación debe usar commits de reversión revisados, preservando
la base y las ramas originales.
