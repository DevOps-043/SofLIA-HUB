## Context

Ver propuesta y Context Pack. Las tres publicaciones síncronas tienen los mismos
pasos y divergen en mensajes de limpieza. La unidad 28 ya conserva propiedad de
cuarentenas y límites temporales; esta unidad no reemplaza esas decisiones.

## Goals / Non-Goals

**Goals:** un ciclo de publicación con propiedad explícita, error primario
estable y diagnóstico de residuos, integrado en tres motores existentes.

**Non-Goals:** abstracción general de filesystem, SQL/cifrado/quotas/retención,
unificar publicación asíncrona de políticas con la síncrona o añadir backoff
bloqueante. Los borrados deliberados deben seguir fallando si no se completan.

## Decisions

- Módulo interno recovery-file-publication con una función síncrona pequeña.
Recibe destino, Buffer, guarda y exclusividad; no inventa políticas ni actor.
Tres usos reales justifican compartirla; conservar tres copias propaga el fallo.
No altera fachadas ni añade un servicio separado o una dependencia.
- Temporal único vecino del destino, creación wx/0600, escritura/fsync/cierre,
guarda y rename o link exclusivo. Siempre cerrar antes de publicar. Si falla
escritura/fsync y cierre también falla, preservar el primer error. Si sólo falla
cierre, rechazar sin publicación. No reintentar close sobre un número de descriptor
incierto: podría haber sido liberado/reutilizado.
- Limpiar sólo un temporal creado. ENOENT es compatible con rename completado;
otros errores producen avisos estáticos distinguiendo resultado de publicación.
Limpieza no convierte fallo en éxito ni éxito comprometido en fallo. Un error
de cierre añade aviso estático sin serializar Error, destino o contenido.
- Motores conservan sus borrados deliberados y cleanup de cuarentenas/journals.
No reutilizar la limpieza tolerante del temporal para borrar copias por solicitud
del usuario: omitir ese fallo violaría retención/revocación.
- La compensación de un archivo sync creado al finalizar tampoco sustituye el
fallo de retirar su marcador. Si ambos fallan, mantener marcador/bloqueo, declarar
el residuo y conservar el primer error; una revisión nueva puede hacer rollback.
- Pruebas de motor antes de extracción para demostrar el defecto, luego matriz
del módulo con disco real y fallos por etapa. Electron recompila el módulo actual
y verifica casos de publicación exclusiva/reemplazo, fallo doble y revocación.

## Risks / Trade-offs

Cierre fallido con estado incierto → rechazar publicación y declarar diagnóstico;
no se promete ausencia de descriptores abiertos ante un fallo real del SO.
Residuos no eliminables → aviso sin rutas, sin afirmar purga automática.
Rename/link sólo garantizan la frontera del syscall → sin bloqueo multiproceso
ni promesa ante corte eléctrico. Los snapshots/proyecciones/lecturas auxiliares
siguen fuera de esta primitiva y necesitan revisión por su propio contrato.
Mensajes operativos convergen en una categoría estática de persistencia → no
son un contrato IPC y no contienen información privada.

## Migration Plan

Sin cambio persistente. Regresiones rojas, módulo/matriz, tres integraciones,
smoke nativo, documentación y gate/build con fuentes congeladas. Reversión
selectiva debe conservar las regresiones probadas y las 28 unidades anteriores;
no reintroducir finally que sustituye el fallo primario. Revisión independiente
pendiente antes de archivar.
