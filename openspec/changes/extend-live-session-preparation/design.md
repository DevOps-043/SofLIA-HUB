## Context

Los 14 entregables aportados por el usuario se producen parcialmente en course-delivery. La API actual conserva escenas y prácticas, con listas vacías de archivos y quizzes. Academy es autoridad académica.

## Goals / Non-Goals

Las dos primeras entregas conservan bloques y notas y añaden documentos estructurados, dependencias de aprobación y publicación por audiencia. Las siguientes ampliaciones están en roadmap.md. Los recursos audiovisuales requieren sus propios vínculos y controles.

## Decisions

- Campo opcional preparation en el manifiesto v1 para conservar envíos anteriores.
- engine_preparation opcional en estado privado de Academy, protegido por grants y RLS existentes. La proyección del participante excluye el campo entero.
- Cabecera X-Soflia-Studio-Preparation: 1 negocia lectura. Respuestas anteriores excluyen el campo incluso para instructores.
- La importación conserva bloques y notas, sin inventar vínculos entre láminas y bloques cuando el origen carece de ellos. Las notas conservan el carácter de notas del ponente.
- Hub consume la preparación en el canal studio existente. El panel privado queda fuera de las escenas del programa audiovisual.
- La ruta firmada de preparación admite hasta 256 KiB de JSON para documentos. Las operaciones ordinarias del aula conservan 32 KiB. Los archivos binarios se incorporan en una entrega posterior.

## Risks / Trade-offs

Revisión del mismo origen, permisos retirados, respuesta perdida y sobrescritura requieren pruebas. Un backend anterior rechaza un manifiesto ampliado y mantiene sus datos. Publicar Academy antes de Architect y Hub. Retirar backends anteriores antes de persistir la ampliación.

## Migration Plan

### Segunda entrega

Los materiales de sesión incorporan instrumentos, contingencias, plantilla de registro y aplicabilidad de ayudas, refuerzo y ausencia. Las nuevas generaciones los exigen. La lectura de versiones anteriores conserva documentos ausentes y permite regenerarlos. Las salidas del plan, agenda, presentación, guía, referencias y ficha se derivan de las entradas aprobadas para evitar divergencias.

El manifiesto agrega documentos estructurados dentro de preparation, con secciones de participante y facilitador. Academy conserva el paquete privado. El instructor publica cada documento autorizado mediante el comando publish_document. El alumno recibe exclusivamente las secciones públicas de los documentos publicados. Una importación nueva limpia la publicación anterior para exigir revisión.

La cabecera X-Soflia-Studio-Documents: 1 negocia estos campos. Las respuestas de la primera entrega omiten documentos dentro de preparation y los campos nuevos del estado. La carga firmada de Architect admite hasta 256 KiB de JSON, con un lector acotado específico para esa ruta. El resto del aula conserva el límite de 32 KiB.

Se conserva el JSON privado de live_studio_state. No hay SQL remoto en esta entrega. Desactivar nuevas entregas en rollback y conservar los snapshots. Verificar clientes anteriores mediante proyección y nuevas sesiones con el piloto.
