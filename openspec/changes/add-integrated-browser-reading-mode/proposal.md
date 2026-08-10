## Why

El navegador integrado permite leer el DOM y actuar sobre una página, pero no ofrece una experiencia enfocada para consumir documentos largos ni convertirlos en audio accesible. El modo lectura reduce distracciones, conserva la procedencia del contenido y permite seguir una narración sincronizada sin abandonar la sesión del navegador.

## What Changes

- Añadir un reproductor de lectura flotante, redondeado y anclado sobre el texto seleccionado o el primer bloque documental, sin sustituir, desplazar ni oscurecer la página.
- Permitir abrirla desde el menú contextual y desde un control visible del navegador cuando exista contenido legible.
- Extraer título, idioma y bloques semánticos sin incluir campos editables genéricos, contraseñas, controles ni datos de otras pestañas; para Google Docs, priorizar selección explícita, exportación autenticada y árbol de accesibilidad sin confundir la interfaz con el documento.
- Integrar ElevenLabs desde Electron main mediante síntesis segmentada con marcas temporales, primer fragmento de baja latencia y precarga acotada, sin exponer la clave al renderer.
- Añadir reproducción, pausa, controles explícitos para reducir o aumentar velocidad, progreso y resaltado sincronizado cuando exista un rango DOM fiable.
- Mantener un seguimiento visual tipo karaoke dentro de la cápsula cuando el documento use un lienzo virtual sin rangos DOM estables, como Google Docs.
- Preparar localmente marcas, decimales y siglas frecuentes para una dicción española consistente, conservando el mapeo entre el texto pronunciado y los offsets originales.
- Incluir estados de configuración ausente, contenido no compatible, proveedor no disponible, cancelación y reintento.

No objetivos: editar o persistir cambios en el documento original, narrar automáticamente sin acción del usuario, almacenar audio o texto en la nube de Pulse Hub, clonar voces o eludir permisos del documento.

## Capabilities

### New Capabilities

- `browser-reading-mode`: extracción segura, activación, experiencia lectora y narración sincronizada del navegador integrado.

### Modified Capabilities

Ninguna.

## Impact

- Electron main: servicio de extracción y ElevenLabs, diálogo de guardado y lifecycle de solicitudes.
- IPC/preload/renderer: contratos tipados para preparar contenido y sintetizar; evento contextual de apertura.
- Renderer React: controlador de audio sin superficie visual; la cápsula contextual vive en un `ShadowRoot` efímero y la página conserva imágenes, gráficas, layout y desplazamiento.
- Página activa: resaltado CSS temporal y reversible del rango narrado, gobernado desde main y eliminado al detener o cerrar.
- Configuración: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` y parámetros no secretos de modelo/formato.
- Seguridad y privacidad: límites de texto/audio, redacción de errores, cancelación, ausencia de persistencia automática y clave restringida a main.
- Documentación y pruebas: arquitectura, IPC, parámetros, requisitos, historias y casos negativos del proveedor.
