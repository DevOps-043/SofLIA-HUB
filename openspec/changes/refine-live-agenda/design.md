# Diseño

## Experiencia
Cabecera compacta, organización visible y pestañas Mi agenda, Organización/Clases que imparto e Historial según capacidades. Una próxima sesión sin ilustración decorativa y lista de las siguientes. Fecha, curso, instructor y duración provienen del catálogo. Los gestores abren el panel existente de Learning para programar/organizar, evitando duplicar reglas de negocio; Preparar aula abre el estudio de Hub. El historial no abre automáticamente el aula ni los medios.

## Contrato y autoridad
La identidad y el permiso académico los verifica Learning. can_teach mantiene su significado existente. El header X-Soflia-Catalog-Capabilities: 1 negocia capabilities version 1; sin él no se amplía la respuesta que consumen clientes estrictos anteriores. period opcional mantiene upcoming por defecto; past requiere instructor y canTeach. El rol global solo informa la etiqueta; no concede permisos ni omite membresía activa.

Main construye management_url a partir de su origen Learning validado y el slug, nunca de URLs remotas. Renderer limita la ruta instructor o detalles de una sesión del catálogo. La gestión conserva autenticación propia de Learning; Hub no exporta tokens a URLs ni suple la sesión del navegador. No se ejecutan escrituras al abrir el panel.

## Fechas y deuda
La función live_catalog aplica el fin estimado de las programadas antes de total/offset/limit. Las que Learning mantiene en vivo no caducan por duración estimada. El historial incluye ended/cancelled y registros vencidos aunque no se haya actualizado su estado; se muestran como Sin cierre registrado, sin mutarlos. El hook descarta datos de consultas anteriores, programa un único vencimiento y revalida al recuperar visibilidad. No introduce polling continuo. Un adaptador visual protege frente a servidores antiguos sin inventar un total corregido.

## Compatibilidad y despliegue
Aplicar la migración de SOFIA Learning, publicar su endpoint y después distribuir Hub. La migración no se ejecuta en esta tarea. Sin endpoint nuevo, se conserva agenda/clases autorizadas y se ocultan historial/gestión web no confirmados. Revertir endpoint/Hub mantiene compatibilidad de v1; restaurar definición SQL anterior revierte el filtro sin borrar historia.
