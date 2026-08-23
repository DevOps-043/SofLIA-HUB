## Context

El chat decide por heurísticas si adjunta una observación del navegador y si habilita el bucle de herramientas. "Documento" hoy activa Computer Use, pero no la lectura de la pestaña. La extracción semántica completa ya existe para el modo lectura y contempla exportación autenticada de Google Docs y respaldo por accesibilidad. La memoria del chat usa una clave estable por usuario, aunque la UI separa conversaciones.

## Goals / Non-Goals

**Goals:**

- Reutilizar la extracción documental existente como capacidad de solo lectura del agente.
- Mantener un vínculo verificable entre resultado, pestaña y URL activas.
- Evitar que memoria histórica compita con una fuente viva.
- Conservar continuidad dentro de cada conversación.
- Reportar agotamiento del bucle como fallo, no como éxito.

**Non-Goals:**

- Editar Google Docs o automatizar su interfaz.
- Cambiar la memoria durable de hechos, preferencias o skills.
- Migrar o borrar mensajes guardados con la clave anterior.
- Añadir dependencias o permisos del navegador.

## Decisions

### Canal de lectura documental dedicado

Se añadirá una operación `integrated-browser:document-read` sin argumentos que valida autenticación y sender mediante el registro común. El servicio main capturará la identidad activa antes de extraer, reutilizará el extractor semántico sin crear una sesión de audio y verificará que `tabId` y URL sigan iguales al terminar.

Alternativa descartada: usar `reading-prepare` desde el chat. Esa operación crea estado de reproducción y mezcla una lectura de IA con el ciclo de vida de la cápsula de audio.

### Herramienta de chat antes de Computer Use

El catálogo declarará `read_active_document` como lectura determinista. Las solicitudes del documento activo habilitarán el bucle únicamente para ejecutar esa herramienta cuando no se pueda precargar el texto; no usarán `use_computer` como primera ruta. El resultado llevará procedencia y una marca explícita de contenido no confiable.

Alternativa descartada: resumir solo la captura/DOM. Google Docs virtualiza el documento y el snapshot está deliberadamente acotado al viewport.

### Sesión reciente por conversación

El renderer derivará la clave `chat:<owner>:conversation:<id>` cuando exista `conversationId`; para chats aún no persistidos usará una clave efímera estable durante el montaje. La memoria durable por owner permanece separada y disponible, pero los mensajes recientes y resúmenes de sesión dejan de cruzar conversaciones.

Alternativa descartada: desactivar toda memoria en lecturas. Perdería preferencias legítimas y continuidad; la solución es separar procedencia y prioridad.

### Contexto vivo con precedencia explícita

Cuando el turno incluye documento extraído, el prompt indicará que memoria y conversación previa no son evidencia sobre esa fuente. Si falla la extracción, el modelo recibirá el error, pero no contenido de otra fuente como reemplazo.

### Cierre estructurado del presupuesto

Los caminos OpenAI y Gemini devolverán un mensaje de presupuesto agotado que no afirma ejecución completa. Se conservará la lista de llamadas ya recopilada para observabilidad de UI y pruebas.

## Risks / Trade-offs

- [La exportación de Google Docs puede fallar por permisos o configuración de accesibilidad] → devolver error recuperable y no degradar al DOM de la interfaz.
- [Una conversación todavía no tiene ID al enviar el primer turno] → usar una clave efímera estable y adoptar el ID persistido en turnos posteriores; el historial visible sigue viajando directamente al modelo.
- [El texto documental puede ser grande] → conservar el límite de 60 000 caracteres y declarar `truncated`.
- [Memoria histórica antigua permanece bajo la clave global] → no se lee como sesión reciente de nuevas conversaciones; no se borra para permitir rollback.

## Migration Plan

1. Añadir el canal y sus cuatro capas, manteniendo intactos los canales existentes.
2. Activar el enrutamiento documental y la clave de memoria por conversación.
3. Añadir regresiones main/renderer y actualizar documentación canónica.
4. Rollback: retirar herramienta/canal y volver a la clave por owner; los registros nuevos quedan inertes y no requieren migración destructiva.
