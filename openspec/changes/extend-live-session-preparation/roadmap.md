# Ruta de implementación entre plataformas

Cada entrega se valida desde generación hasta consumo y se activa primero en Academy.

Las entregas 1 y 2 tienen implementación local. La generación real y el piloto siguen pendientes de operación autorizada.

| Entrega | Architect | Academy | Hub | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| 1. Plan y notas | Serializar plan aprobado y notas existentes, validar límites. | Guardar revisión y proyección privada, compatibilidad por cabecera. | Mostrar secuencia, duración y notas. | Otro instructor autorizado abre la misma revisión y el alumno carece del contenido privado. |
| 2. Documentos y dependencias | Completar los 11 entregables base y registrar aplicabilidad de los tres condicionales. Aprobación por huellas y dependencias. | Recibir versión de paquete con referencias y audiencias verificables. | Consultar guía, ficha y contingencias, publicar consignas autorizadas. | Cambio de fuente o plan invalida derivados afectados. Cada documento tiene audiencia y revisión. |
| 3. Archivos | Vincular a bloques por ID estable, producir o seleccionar recursos aprobados. | Cargas privadas acotadas a organización/sesión/revisión, metadatos e integridad. | Preparar medios y renovar URLs temporales. | Fallo de archivo conserva última revisión válida; recurso ajeno es denegado. |
| 4. Emisión y encuestas | Distinguir demo/guía/B-roll y encuesta frente a evaluación. Guion aprobado explícito. | Tipar interacción y respuestas, permisos y estado de publicación. | Emitir video/audio, teleprompter y lanzar encuestas. | Instructor controla emisión; guion queda fuera de salida y acceso del alumno. |
| 5. Registro y continuidad | Plantillas con criterios y referencias. Recuperación/postcurso según aplicabilidad. | Persistir asistencia/evidencias/resultados con ownership e idempotencia. | Capturar y consultar durante el vivo. | Distinguir plantilla y ejemplo de resultados reales; continuidad en Academy con el recorrido híbrido. |

La matriz de los 14 entregables está en [diseño de integración](../../../docs/architecture/architect-live-preparation-delivery.md). Las duraciones se validan desde el plan. El orden de bloques es canónico y los vínculos de recursos se crean en autoría, con IDs persistentes. Los archivos grandes viajan por almacenamiento privado bajo control de Academy.

La operación exige cursos, organización y cuentas de QA autorizados, Academy compatible y un Hub del mismo contrato. Las pruebas locales con dobles verifican reglas de código. El piloto verifica disponibilidad de medios, permisos reales y salida audiovisual.
