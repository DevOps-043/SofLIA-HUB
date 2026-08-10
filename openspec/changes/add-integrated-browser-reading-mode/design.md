## Context

El navegador integrado usa `WebContentsView`, que se compone por encima del renderer. Ya existe un evento contextual inicial para solicitar modo lectura, un flujo seguro para ocultar temporalmente la vista nativa y contratos IPC tipados para el navegador. ElevenLabs no está integrado; la voz actual de la orbe usa otro proveedor y no entrega alineación temporal.

La referencia del proveedor confirma que `POST /v1/text-to-speech/:voice_id/with-timestamps` devuelve MP3 y alineación por carácter. El modo lectura necesita esa alineación para que el subrayado siga el audio real.

## Goals / Non-Goals

**Goals:**

- Reutilizar la sesión y pestaña activa sin recargarla ni ocultar su contenido visual.
- Mantener extracción, proveedor y validación de buffers en Electron main.
- Reproducir segmentos de forma incremental para limitar latencia y memoria.
- Sincronizar el resaltado con marcas temporales, no con estimaciones de palabras por minuto.
- Fallar de forma explícita y recuperable ante contenido opaco o proveedor no configurado.

**Non-Goals:**

- Editar, guardar o reestructurar el documento original.
- Conservar una biblioteca permanente de audiolibros.
- Clonar voces o administrar la cuenta ElevenLabs.
- Extraer contenido de frames cross-origin o romper restricciones de Google Drive/PDF.

## Decisions

### Extracción en la pestaña activa con identidad de origen

`IntegratedBrowserService` preparará una lectura contra el `tabId` y URL activos. Una selección contextual llevará la URL de origen; si ya no coincide con la pestaña enfocada se rechazará. Sin selección, un extractor ejecutado dentro de la página recorrerá `main`, `article`, landmarks y bloques textuales, excluyendo elementos editables, formularios y nodos no visibles.

Google Docs se trata como una aplicación virtualizada: primero se solicita su exportación textual con `contents.session.fetch`, que usa la misma sesión autenticada del `WebContentsView`; si no está disponible, se conecta brevemente el depurador de Electron para consultar `Accessibility.getFullAXTree` y se desconecta inmediatamente. Si ambas rutas fallan, el lector devuelve un error recuperable y nunca ejecuta el extractor DOM general sobre menús o pestañas.

Alternativa descartada: reutilizar sin cambios el snapshot DOM del agente. Ese snapshot está deliberadamente acotado al viewport y controles, por lo que perdería secciones largas del documento.

### Cápsula flotante dentro de la página y vista nativa siempre visible

El controlador React permanece sin superficie visual y gobierna audio y cola. La cápsula se instala en un `ShadowRoot` efímero dentro de la página activa y se ancla al primer rectángulo visible de la selección; si no existe una selección compatible, se ubica sobre el primer rango narrable. En Google Docs no busca palabras de respaldo en el DOM de la interfaz. Sus acciones se entregan mediante una espera IPC bloqueante y cancelable, no mediante polling. El estado del reproductor vuelve a la cápsula por un contrato acotado. No se cambia el viewport, no se usa snapshot, no se llama `hide()` y no se reemplaza el documento con una copia textual.

La estructura de la cápsula se crea exclusivamente con `createElement`, `createElementNS`, `textContent`, `setAttribute` y `append`; no usa `innerHTML`, `outerHTML` ni fragmentos HTML. Esto mantiene compatibilidad con páginas que activan `require-trusted-types-for 'script'`, como Gmail, sin crear una política Trusted Types propia ni relajar la CSP del sitio.

Alternativas descartadas: el panel de pantalla completa impedía consultar el contexto visual; una franja React reservaba altura y desplazaba la página; un overlay React no puede componerse por encima de `WebContentsView`; una ventana transparente independiente ampliaría foco, lifecycle y consumo de recursos.

### Servicio ElevenLabs sin SDK adicional

Un servicio main usará HTTPS/fetch contra el endpoint oficial `with-timestamps`, con `xi-api-key`, timeout, `AbortController` y respuesta validada. No se añade el SDK: la integración usa un único endpoint y evitar una dependencia reduce tamaño y superficie de suministro. La configuración se leerá de variables no `VITE_*` cargadas por main: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, y opcionalmente modelo/formato.

Cada solicitud aceptará un segmento normalizado de hasta 3.500 caracteres como límite defensivo, pero el renderer usará un microlote inicial cercano a 180 caracteres y lotes posteriores cercanos a 480. El primer corte prioriza una frontera de frase y, tan pronto se obtiene, arranca la preparación de hasta dos lotes posteriores antes de iniciar la decodificación local. La cola deduplica solicitudes, limita concurrencia, aplica un timeout estricto por lote y cancela todo trabajo pendiente al detener o cerrar; no sintetiza el documento completo antes de reproducir.

Se conserva `eleven_turbo_v2_5` como modelo configurado por defecto. No se activa `optimize_streaming_latency` porque el proveedor lo marca como obsoleto. La reducción de latencia se obtiene con lotes pequeños, reutilización de conexión, anticipación acotada y fallo rápido; no se realizan reintentos automáticos de una operación facturable.

Los errores del proveedor pueden llegar como `detail` textual o como objeto con
`status`, `code`, `type` y `message`. Main normaliza exclusivamente esos campos,
mapea causas conocidas a mensajes operables en español y no expone la respuesta
completa. Un HTTP 404 o `voice_not_found` se trata como una incompatibilidad
entre `ELEVENLABS_VOICE_ID` y el workspace de la clave; no se intenta otra ruta,
voz o modelo porque ocultaría una configuración incorrecta y podría consumir
cuota con una identidad de voz no aprobada.

### Posición manual de la cápsula

La cápsula incorpora un asa dedicada con Pointer Events. Durante el arrastre captura el puntero, calcula la posición en coordenadas de viewport y la limita a un margen visible. Tras el primer movimiento manual, los eventos de scroll ya no vuelven a anclarla a la selección; resize solo limita la posición vigente. Un doble clic sobre el asa restablece el anclaje automático. La posición es efímera y no se persiste ni se comparte con la página.

### Alineación global por offsets y resaltado no destructivo en página

La respuesta normalizada de ElevenLabs se transformará en rangos de palabras con tiempos de inicio/fin. Cada segmento conserva su offset absoluto dentro del texto preparado. El renderer usa `audio.currentTime` y búsqueda binaria para determinar el rango activo, y envía únicamente el rango vigente a un canal IPC acotado.

Main valida lectura, pestaña, URL y offsets antes de actualizar un `CSS Custom Highlight` temporal en la página. La instalación construye una correspondencia efímera entre texto normalizado y nodos DOM sin envolver, editar ni persistir elementos. El resaltado se elimina al detener, cerrar, navegar o expirar la sesión; los cambios de palabra se deduplican para evitar trabajo IPC redundante.

Google Docs no expone rangos DOM estables para el lienzo documental. En ese dominio se omite el mapa de CSS Highlights y la narración continúa sin intentar encontrar el texto exportado dentro de etiquetas de la interfaz.

Como degradación accesible, la cápsula muestra el token original que corresponde a las marcas temporales y lo subraya mientras se pronuncia. El indicador no intenta usar `findInPage`, no altera la selección ni escribe formato dentro de Google Docs. Esto evita falsos positivos sobre menús y conserva un seguimiento visual exacto aun cuando el editor pinta el documento en un lienzo virtual.

Alternativa descartada: crear un `span` por carácter. En documentos largos aumentaría de forma innecesaria nodos y reconciliaciones React.

### Pronunciación española con offsets reversibles

Antes de sintetizar se construye una representación de voz efímera. Esta expande localmente decimales como `5.12` a “cinco punto doce” y adapta la marca `SofLIA` a “Soflía”, sin modificar el texto visible ni persistir una copia. Cada frontera del texto preparado conserva su offset de origen, por lo que la alineación de ElevenLabs vuelve al documento original aunque la longitud pronunciada cambie.

Las solicitudes fijan `language_code: "es"` para contenido español y envían contexto anterior y posterior acotado para mantener continuidad entre microlotes. Se conserva `apply_text_normalization: "auto"`: ElevenLabs puede normalizar otros símbolos, mientras los casos de producto conocidos se resuelven localmente y sin depender de un diccionario remoto. Turbo v2.5 no recibe fonemas IPA; la documentación del proveedor indica usar alias en modelos que no soportan esos fonemas.

### Contrato IPC de cuatro capas

El contrato incluye `reading-prepare`, `reading-synthesize`, `reading-highlight`, `reading-cancel`, `reading-close`, `reading-toolbar-wait` y `reading-toolbar-sync`, además del evento contextual existente. Todos pasan por servicio main, handler autenticado y con sender validado, allowlist/preload y wrapper tipado del renderer. No existe una operación de descarga o escritura de audio. Los errores serán códigos/mensajes saneados y nunca incluirán clave, cuerpo del proveedor ni ruta completa.

## Risks / Trade-offs

- [Google Docs y visores PDF pueden renderizar texto en canvas o frames opacos] → Priorizar selección explícita, accesibilidad/DOM disponible y error honesto cuando no exista contenido extraíble.
- [Una página puede cambiar el DOM después de preparar la lectura] → Validar pestaña/URL, detectar referencias desconectadas y degradar solo el subrayado; el audio y la página permanecen operables.
- [La síntesis consume cuota por caracteres] → Acción explícita, generación incremental y ausencia de reintentos automáticos no idempotentes.
- [Audio base64 aumenta memoria transitoria] → Segmentos pequeños, una cola corta, límites main y revocación inmediata de URLs al cerrar.
- [El proveedor puede devolver alineación inválida o parcial] → Validación estricta y fallback visual al bloque narrado, sin inventar tiempos por palabra.

## Migration Plan

1. Añadir servicio, contratos y UI detrás de la disponibilidad de `window.integratedBrowser`.
2. Mantener navegación y menú contextual existentes; sin clave, solo funciona la lectura visual.
3. Documentar variables de entorno y límites operativos.
4. Rollback: retirar los canales de lectura y el reproductor; el evento contextual se puede conservar sin consumidor o quitar junto con la entrada de menú. El limpiador del resaltado debe ejecutarse antes de retirar la sesión.
