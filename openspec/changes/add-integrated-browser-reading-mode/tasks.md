## 1. Contratos y extracción

- [x] 1.1 Definir tipos, límites y validadores del contenido lector, síntesis y cancelación.
- [x] 1.2 Implementar extracción semántica de selección o documento activo con identidad de pestaña y exclusión de datos sensibles.
- [x] 1.3 Implementar servicio ElevenLabs con timestamps, timeout, cancelación y límites de audio transitorio.

## 2. Electron e IPC

- [x] 2.1 Integrar lectura y voz al servicio del navegador y completar handlers autenticados con errores saneados.
- [x] 2.2 Completar allowlist, preload, tipos globales y wrapper renderer para los cuatro canales y el evento contextual.
- [x] 2.3 Cubrir handler, sender, payload inválido, proveedor ausente, cancelación y expiración con pruebas main.

## 3. Experiencia del modo lectura

- [x] 3.1 Implementar panel lector responsive con jerarquía documental, tamaños tipográficos y restauración de la vista nativa.
- [x] 3.2 Implementar cola incremental de audio, reproducción, pausa, velocidad, progreso y salto entre fragmentos.
- [x] 3.3 Implementar subrayado sincronizado por timestamps y seguimiento visual.
- [x] 3.4 Integrar apertura desde selección, menú contextual y control visible, con estados vacío, configuración, error y reintento.
- [x] 3.5 Cubrir UI, sincronización, cierre/cancelación y regresión de navegación con pruebas renderer.

## 4. Documentación y cierre

- [x] 4.1 Actualizar arquitectura, IPC, parámetros, configuración, requisitos, historias y trazabilidad.
- [x] 4.2 Ejecutar pruebas focalizadas, typecheck, lint cambiado, arnés, documentación, OpenSpec y build.
- [x] 4.3 Ejecutar `verify:pr`, revisión adversarial de privacidad/recursos/IPC y registrar riesgos residuales.

## 5. Revisión de experiencia sobre el documento original

- [x] 5.1 Sustituir el panel de pantalla completa por un reproductor compacto con controles simétricos de reproducción, progreso, velocidad y cierre.
- [x] 5.2 Mantener `WebContentsView` visible y reajustar únicamente su viewport al abrir o cerrar el reproductor.
- [x] 5.3 Añadir resaltado DOM temporal por rango, con contrato IPC tipado, validación de sesión/pestaña/URL, deduplicación y limpieza.
- [x] 5.4 Actualizar pruebas, documentación y evidencia; ejecutar las compuertas proporcionales y revisión adversarial.

## 6. Cápsula contextual y síntesis anticipada

- [x] 6.1 Instalar una cápsula flotante redondeada en el DOM de la página, anclada a la selección y sin modificar el viewport.
- [x] 6.2 Completar los contratos IPC tipados para esperar acciones y sincronizar el estado de la cápsula sin polling.
- [x] 6.3 Reducir el primer segmento y precargar hasta dos segmentos posteriores con deduplicación, cancelación y límites de memoria.
- [x] 6.4 Reintegrar el controlador de lectura al panel actual y cubrir apertura contextual, acciones, errores y cierre con pruebas.
- [x] 6.5 Actualizar documentación y evidencia; ejecutar verificación proporcional y revisión adversarial.

## 7. Compatibilidad con Trusted Types

- [x] 7.1 Sustituir la construcción con `innerHTML` por nodos DOM/SVG seguros y liberar esperas al reinstalar la cápsula.
- [x] 7.2 Cubrir la regresión con una política simulada que rechace `innerHTML`, actualizar evidencia y ejecutar las compuertas proporcionales.

## 8. Microlotes de baja latencia y cápsula movible

- [x] 8.1 Reducir el lote crítico inicial, preparar los siguientes lotes al recibirlo y acotar el timeout sin reintentos automáticos.
- [x] 8.2 Hacer arrastrable la cápsula mediante un asa accesible, limitarla al viewport y permitir restablecer su anclaje.
- [x] 8.3 Clasificar los mensajes de consola observados y conservar las protecciones Chromium sin relajar `webSecurity` ni reescribir cabeceras de terceros.
- [x] 8.4 Añadir pruebas de segmentación, anticipación, timeout, arrastre y limpieza; actualizar evidencia y ejecutar las compuertas proporcionales.

## 9. Diagnóstico de voz ElevenLabs no encontrada

- [x] 9.1 Normalizar errores estructurados de ElevenLabs y distinguir voz, modelo, permisos, créditos y formato sin filtrar el cuerpo del proveedor.
- [x] 9.2 Mostrar una acción operable para HTTP 404/`voice_not_found` sin fallback silencioso ni reintentos automáticos.
- [x] 9.3 Cubrir variantes de error antiguas/nuevas, actualizar configuración y evidencia, y ejecutar verificación proporcional.

## 10. Lectura semántica de Google Docs y retiro de descarga

- [x] 10.1 Extraer Google Docs mediante la sesión autenticada de Electron y usar el árbol de accesibilidad de Chromium como respaldo temporal.
- [x] 10.2 Impedir el fallback al DOM de la interfaz y degradar el subrayado cuando no exista un rango documental fiable.
- [x] 10.3 Retirar botón, estado, caché y canal IPC de descarga de audio en main, preload y renderer.
- [x] 10.4 Cubrir exportación, árbol AX, fallo seguro y ausencia de subrayado falso; actualizar documentación y evidencia.

## 11. Seguimiento visual y dicción española

- [x] 11.1 Añadir seguimiento tipo karaoke en la cápsula para documentos sin rangos DOM fiables, sin usar coincidencias de la interfaz.
- [x] 11.2 Normalizar localmente `SofLIA`, decimales y contexto de microlotes, preservando el mapeo de timestamps al texto original.
- [x] 11.3 Fijar el idioma de ElevenLabs a partir del documento y cubrir dicción, offsets y compatibilidad de la Orbe con pruebas focalizadas.
- [x] 11.4 Actualizar documentación y evidencia; ejecutar verificación proporcional y revisión adversarial.
