# Segunda entrega de documentos

Implementación local verificada el 17 de noviembre de 2026 en Architect, Academy y Hub. La operación real y el despliegue siguen pendientes del piloto.

## Comportamiento

Architect genera instrumentos, contingencias, plantilla vacía de registro y aplicabilidad de ayudas, refuerzo y ausencia. Las otras salidas se derivan del contenido aprobado y forman un paquete de 14 documentos con secciones de participante y facilitador. Las nuevas aprobaciones de materiales exigen documentos completos. La lectura de material anterior conserva su compatibilidad y señala documentos pendientes.

Los documentos se aprueban junto con los materiales de sesión. Las huellas de contenido, planes y fuentes invalidan la aprobación cuando cambian sus dependencias. Los documentos de plan, agenda, presentación, guía, referencias y ficha conservan las entradas aprobadas como origen.

Academy conserva el paquete privado. El instructor puede publicar y retirar las secciones públicas por identificador. El participante recibe únicamente los documentos publicados, sin respuestas esperadas ni notas privadas. Importar otra revisión requiere publicar de nuevo; reenviar la misma revisión y huella conserva la publicación existente.

X-Soflia-Studio-Documents negocia la ampliación. Clientes de la primera entrega conservan la forma anterior. El JSON de preparación firmada admite 256 KiB. Los comandos ordinarios mantienen 32 KiB. Los archivos binarios siguen en la siguiente entrega.

## Evidencia

| Verificación | Resultado |
| --- | --- |
| Architect, test:course-delivery | 34 pruebas aprobadas. Incluyen documentos obligatorios, aplicabilidad, fuentes, bloques, invalidación, exportación pública y rangos de plantilla. |
| Academy, seis suites dirigidas | 35 pruebas aprobadas. Incluyen publicación, retirada, privacidad, clientes anteriores, límites, reenvío idempotente y protección del trabajo existente. |
| Hub, cinco suites dirigidas | 56 pruebas aprobadas. Incluyen panel de instructor, vista de participante, dominio y frontera HTTP. |
| Tipos de Architect y Hub | Aprobados en las comprobaciones locales de la entrega. |
| Tipos dirigidos de Academy | Contratos, dominio y proyección aprobados con TypeScript estricto. |
| Lint | Architect dirigido aprobado y Hub incremental sin deuda nueva. |
| Contratos | Sincronizador canónico de Hub y comparación de las copias de preparación en las tres plataformas. |

La compilación global de Academy sigue detectando dependencias ausentes y referencias generadas de Next.js. Se corrigió la respuesta tipada de rate limiting en la ruta ampliada de preparación. La última salida global no reporta errores en los archivos modificados de esta entrega.

## Compuertas y límites

verify:pr de Hub se detiene en la comprobación de la versión del ejecutable Electron instalado. verify:pr de Architect se detiene en enlaces del reporte previo de Herk Edit Kit. Estas compuertas quedan pendientes. Las suites SQL que requieren PGlite no se ejecutan en el checkout que carece de esa dependencia.

La prueba con proveedor de generación real, revisión pedagógica de sus resultados, emisión y piloto de aula permanecen pendientes. Los documentos actuales son contenido estructurado y exportación HTML existente. Los archivos y videos se incorporan en entregas posteriores.

## Revisión de seguridad y consistencia

Se comprobaron roles, exclusión de soluciones, validación de referencias, límites, cambios de entrada y publicación explícita. La revisión detectó que un reenvío idéntico por otro actor autorizado podía volver a importar el paquete y retirar lo publicado. Se corrigió mediante la revisión y huella ya almacenadas y una prueba negativa de escritura.

La importación manual también rechaza reemplazar el paquete cuando ya hay respuestas o entregas. El commit existente usa revisión y bloqueo para evitar sobrescribir un cambio concurrente. La protección conserva el trabajo de participantes.

Publicar Academy compatible antes de Architect y Hub. Mantener backends capaces de leer el JSON ampliado tras la primera escritura. Un rollback de clientes conserva esos backends y datos. Las tareas de archivos, multimedia, registro real y piloto siguen abiertas.
