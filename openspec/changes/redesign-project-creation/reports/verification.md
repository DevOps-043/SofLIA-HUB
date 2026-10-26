# Verificación de la creación de proyectos

Estado: reporte histórico de la primera iteración, corregida posteriormente por el usuario. Fecha: 2026-10-24. Rama: `codex/project-creation-modal`, base `427b9fb`. La implementación vigente usa selector nativo y almacenamiento del usuario; este reporte conserva la evidencia anterior y no describe las opciones actuales.

## Resultado

Se retiró el formulario del lateral. Nuevo proyecto usa un diálogo modal en la ventana principal, con nombre y organización activa fija, elección local/nube, destino final visible y carpetas adicionales privadas. El explorador también vive dentro del diálogo. La lista sólo solicita proyectos del workspace correspondiente a la organización activa y descarta respuestas al cambiar contexto.

Se completaron servicio, handlers con caller de ventana principal, schemas estrictos, allowlist, preload y wrapper. El registro privado de ubicaciones usa cifrado del SO y separación por usuario/proyecto. Los manifiestos no incluyen rutas ni credenciales. Las carpetas se crean exclusivamente; los vínculos adicionales no copian ni publican contenido. Se protege el manifiesto frente a modificaciones durante la petición y se retienen efectos locales ante fallos. Un resultado remoto incompleto o incierto bloquea el reenvío de la misma operación.

## Evidencia ejecutada

- Suite general `npm test -- --silent --reporter=json`: 5718 casos aprobados, 5 omitidos y cero fallos. Después de añadir las últimas regresiones se repitieron los cinco archivos focalizados: 92 casos aprobados, incluidos organización, disco, contratos IPC y superposición sobre el navegador nativo.
- Pruebas de integración Project Hub previas a las últimas regresiones: siete archivos y 226 casos correctos. Incluyen los canales heredados y el bridge de cuatro capas.
- `node test/manual/project-creation/smoke.mjs <directorio-de-capturas>`: correcto. Una ventana Electron oculta, selector dentro del mismo diálogo, carpeta principal/adicional, nube, creación, Escape, foco restaurado, claro/oscuro, 320 px y zoom 200 %. Capturas inspeccionadas visualmente. Fixture con datos ficticios, sin credenciales, preload de producción ni escrituras remotas.
- Lint incremental: sin incidencias nuevas. Documentación, arnés y OpenSpec estricto correctos. Se actualizaron el catálogo de 525 canales y el inventario de pruebas mediante los datos derivados.
- `npm run verify:pr`: ejecutado. El typecheck general queda bloqueado por once diagnósticos anteriores en correo (`newline` de MailComposer) y Zoom (Video SDK ausente y tipos derivados). Una comparación del mismo compilador/dependencias usando las fuentes de HEAD frente al árbol modificado produjo 11 errores en ambos y cero diagnósticos introducidos. No se alteraron esos módulos ni se amplió un baseline para ocultarlos.

## Límites y recuperación

La correspondencia organización/workspace utiliza una lectura del directorio IRIS restringida a los IDs ya autorizados por Project Hub. No se consultaron datos reales, cambiaron grants/RLS, aplicaron migraciones ni desplegó servidor. Si ese directorio no es accesible en un entorno, el flujo falla cerrado; no hay fallback por nombre.

Nube significa el Storage existente de Soflia. Drive/OneDrive se admiten mediante carpetas disponibles en el equipo; OAuth directo y motores nuevos de sincronización siguen pendientes. Las carpetas vinculadas se registran como ubicaciones, sin indexar archivos ni conceder herramientas nuevas al agente. El negocio sigue en Project Hub/IRIS incluso cuando se elige una carpeta local.

El diario evita reenvíos de la misma operación; no implementa conciliación ni reanudación automática. Una pérdida de respuesta requiere comprobar la lista y la carpeta. No existe una transacción entre disco y servidor, y no se promete protección frente a un proceso ajeno con control concurrente de todo el directorio del usuario. No se borran carpetas al cancelar o fallar.

No se empaquetó ni publicó una versión. Para retirar este cambio se revierten sus fuentes y documentación, conservando los proyectos remotos y las carpetas que una persona haya creado con el nuevo flujo.
