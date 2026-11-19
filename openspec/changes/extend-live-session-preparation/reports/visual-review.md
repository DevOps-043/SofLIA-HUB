# Primera revisión visual de la preparación

## Preparación para publicar la rama

El 18 de noviembre se repitieron las tres suites de interfaz: 8 pruebas de documentos/conducción aprobadas y 20 de participante aprobadas al repetir esa suite por separado después de un timeout de inicio de worker. Lint incremental aprobado en tres archivos. Enlaces válidos en 1122 documentos y OpenSpec estricto aprobado. verify:pr aprobó adaptadores, arnés, cadena de suministro, integridad CI y runtime estable; se detuvo en el inventario previo de pruebas desactualizado de docs:system:check. No se cambió el inventario ni se declaró aprobada la compuerta global. Se revisó el diff de publicación: mantiene la exclusión de notas privadas para participantes y el bloqueo de acciones durante guardado. La diferencia local sin contenido en recordings.contract.ts queda fuera del commit. Publicación de rama autorizada; merge, despliegue y piloto continúan pendientes.

Fecha: 18 de noviembre de 2026. Cambios locales sin commit, publicación ni despliegue en esta revisión.

## Alcance y resultado

Architect conserva su tipografía de títulos y tokens `engine-*`. El panel de impartición, el editor y la entrega usan superficies y controles de sus temas claro y oscuro. Las colecciones de campos se despliegan por sección, con estados por sesión y acciones agrupadas. Las salidas distinguen presentación, guía privada y material del participante. El formulario ofrece estados de consulta, entrega, confirmación y error. Se corrige el texto anterior que afirmaba que las notas permanecían únicamente en Engine.

Hub conserva los tokens del estudio. Plan y notas se consultan mediante acordeones con foco visible. Los documentos distinguen «Sin compartir», «Compartido con el grupo», «Solo instructor» y «No aplica». Las secciones reservadas y compartibles tienen etiquetas e iconos separados. Publicar y retirar conserva el comando existente. El participante recibe tarjetas de lectura con ajuste de texto. El componente de documento se separa del panel de conducción.

Academy/Learning conserva su UI: esta ampliación de recepción y proyección no incorporó una pantalla propia. No se cambian sus archivos en esta pasada, ni se considera revisado el resto de su producto.

## Revisión visual ejecutada

Se renderizan los componentes reales con datos sintéticos y controladores locales en un servidor de QA ligado a 127.0.0.1. La preparación de QA vive fuera de los repositorios, bajo la carpeta de visualizaciones de esta conversación. No llama a Learning, a la base ni al proveedor de IA. Las confirmaciones observadas son respuestas simuladas para revisar la interfaz.

- Architect: temas claro y oscuro; entrega amplia y contenedor de 390 px; consulta de aulas, selección de origen/destino, espera, confirmación y error recuperable; editor de materiales, expansión de instrumentos, edición y comando de guardado simulado.
- Hub: temas claro y oscuro; panel de 310 px y composición estrecha; consulta de secciones privadas/públicas, publicación y retirada reflejadas en la vista del participante, estado vacío después de retirar.
- El editor de Architect midió 390 px de ancho visible y de scroll, sin descendientes más anchos. La navegación por teclado mostró contorno sólido en el campo enfocado. Se mantienen controles nativos y etiquetas.

La vista aislada de Hub usa el estado responsive `show-activities` del contenedor real para mantener visible la caja de herramientas. Architect usa sus fuentes de fallback porque los estilos de fuente de Next no se cargan en la vista aislada. No se certifica aún la integración en el shell completo, sus fuentes descargadas, el instalador Electron, los lectores de pantalla ni todos los tamaños de dispositivo.

## Verificación automática

- Hub: renderer TypeScript aprobado con heap de 4 GiB. Suites StudioDocuments, StudioConductionPanel y ParticipantStudio: 28 pruebas aprobadas. Incluyen publicación, retirada, privacidad, bloqueo durante guardado y documentos no aplicables.
- Architect: `npm run typecheck` aprobado y ESLint dirigido a los tres componentes modificados aprobado.
- Hub: lint incremental aprobado, tres archivos sin deuda nueva.
- Las comprobaciones iniciales dentro del sandbox no avanzaron y se interrumpieron. El pool de procesos de Vitest también falló al iniciar los tres workers; las suites se repitieron fuera del sandbox con un solo worker y `--pool=threads`, donde aprobaron. No se debilitaron aserciones.

Las compuertas globales pendientes registradas en documents-verification.md continúan pendientes; esta pasada no ejecuta verify:pr ni sustituye el piloto autenticado. Los contratos de API, SQL, permisos, generación y transferencia de archivos conservan su implementación anterior.

## Evidencia local y continuidad

Las capturas architect-light.jpg, architect-dark-narrow.jpg, architect-editor-dark-narrow.jpg y hub-dark.jpg se conservan en la carpeta `session-preparation-qa` de las visualizaciones de esta conversación. Son evidencia de componentes con datos de QA y no de una entrega real. El siguiente paso de QA debe revisar estas vistas dentro de Architect autenticado y Hub completo, con documentos reales de distintas longitudes y con el flujo remoto autorizado.
