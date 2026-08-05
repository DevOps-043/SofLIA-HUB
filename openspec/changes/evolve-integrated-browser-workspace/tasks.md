## 1. Stores y contratos de seguridad

- [x] 1.1 Implementar tipos compartidos y validación para historial, credenciales y extensiones.
- [x] 1.2 Implementar `BrowserHistoryStore` acotado, saneado y recuperable con pruebas.
- [x] 1.3 Implementar `BrowserCredentialVault` cifrado, metadata-only y autofill por origen con pruebas negativas.
- [x] 1.4 Implementar `BrowserExtensionManager` con validación, HITL, root administrado, carga y remoción segura.

## 2. Integración Electron e IPC

- [x] 2.1 Integrar stores/managers al ciclo de vida de `IntegratedBrowserService` sin exponerlos al agente.
- [x] 2.2 Ampliar handlers con autenticación, sender, límites y errores controlados por operación.
- [x] 2.3 Añadir grupo de canales, API preload y wrapper/tipos renderer para los tres dominios.
- [x] 2.4 Ampliar mocks y pruebas de handler, allowlist, preload y wrapper.

## 3. Workspace lateral

- [x] 3.1 Separar apertura del navegador de `ActiveView` y conservar el chat activo como instancia única.
- [x] 3.2 Implementar workspace con chat izquierdo, navegador derecho, cierre y restauración de Sidebar.
- [x] 3.3 Implementar splitter accesible, ancho persistente, límites responsivos y expansión completa.
- [x] 3.4 Mantener apertura solicitada por agente y publicación correcta de bounds durante resize.

## 4. Experiencia de administración

- [x] 4.1 Añadir drawer de historial con búsqueda, reapertura, estados y borrado explícito.
- [x] 4.2 Añadir bóveda de contraseñas con guardado, metadata, selección, fill explícito y eliminación.
- [x] 4.3 Añadir gestor de extensiones con selección nativa, permisos visibles, habilitar/deshabilitar y remover.
- [x] 4.4 Cubrir panel, split y gestores con pruebas renderer de éxito, vacío, error y cancelación.

## 5. Documentación y verificación

- [x] 5.1 Actualizar arquitectura Electron/IPC, seguridad, parámetros, UX, requisitos, historias y trazabilidad.
- [x] 5.2 Ejecutar pruebas dirigidas, typecheck, lint cambiado, arnés, documentación, OpenSpec y build.
- [x] 5.3 Ejecutar `verify:pr`, registrar excepciones ambientales reales y smoke manual cuando sea posible.
- [x] 5.4 Ejecutar revisión adversarial de secretos, extensiones, paths, permisos, concurrencia, resize y cleanup; corregir hallazgos.

## 6. Observación del agente y controles refinados

- [x] 6.1 Detectar referencias a la vista actual y exigir inspección del navegador integrado antes de responder.
- [x] 6.2 Reforzar prompt, declaraciones de herramientas y pruebas de ruteo para observación e interacción sobre la misma sesión.
- [x] 6.3 Rediseñar barra superior y splitter con iconos, hit areas, feedback de arrastre, teclado y doble clic.
- [x] 6.4 Ejecutar pruebas dirigidas, gate proporcional y smoke real de observación/control del navegador.

## 7. Migración visual premium de gestores

- [x] 7.1 Convertir historial, contraseñas y extensiones en un panel flotante redondeado con navegación segmentada, estados completos y responsive.
- [x] 7.2 Implementar captura temporal para superponer gestores sin perder la sesión del `WebContentsView`.
- [x] 7.3 Sustituir confirmaciones nativas destructivas y de permisos de extensión por modales renderer accesibles con HITL explícito.
- [ ] 7.4 Actualizar pruebas, documentación y ejecutar verificación proporcional más QA visual real.
- [x] 7.5 Convertir el chat compacto en panel flotante redondeado, redimensionable y colapsable.
- [x] 7.6 Mantener el `WebContentsView` vivo mediante bounds con inset durante el chat y ocultarlo solo durante gestores.

## 8. Estabilidad y controles del sidecar

- [x] 8.1 Añadir barra compacta con mover/minimizar y eliminar header completo y overflow horizontal del chat.
- [x] 8.2 Mantener la vista nativa visible con inset izquierdo/derecho y recuperar ancho completo al minimizar.
- [x] 8.3 Eliminar estacionamiento fuera de pantalla y polling de PNG durante Computer Use.
- [x] 8.4 Fallar cerrado en tareas del navegador integrado sin fallback silencioso al desktop o navegador externo.
- [x] 8.5 Actualizar pruebas/documentación y ejecutar verificación proporcional más revisión adversarial.

## 9. Alineación, modelo de Computer Use y continuidad

- [x] 9.1 Medir el inicio del viewport web y alinear debajo de la barra superior el chat flotante y su divisor.
- [x] 9.2 Fijar visión legacy y Computer Use en `gemini-3.6-flash`, conservando el catálogo y ruteo conversacional del usuario.
- [x] 9.3 Ampliar de forma acotada el presupuesto de Computer Use para el navegador integrado y mejorar el outcome al agotarse.
- [x] 9.4 Cubrir alineación, modelo fijo de Computer Use, catálogo conversacional y presupuesto con pruebas; actualizar documentación y ejecutar revisión adversarial.

## 10. Pestañas, doble vista y Modo Orbe

- [x] 10.1 Ampliar tipos y `IntegratedBrowserService` con pestañas acotadas, popups internos, foco, cleanup y geometría simple/dividida/superpuesta.
- [x] 10.2 Completar handlers, allowlist, preload y wrapper tipado para crear/cerrar/activar pestañas, elegir composición y abrir la Orbe.
- [x] 10.3 Implementar barra de pestañas, controles de doble vista, restauración del chat y Modo Orbe sin desmontar conversación.
- [x] 10.4 Compactar header y compositor, corregir placeholder responsive y cubrir regresiones visuales con pruebas renderer.
- [x] 10.5 Actualizar documentación, ejecutar verificación proporcional y revisión adversarial.

## 11. Selector por proveedor y razonamiento

- [x] 11.1 Restaurar los cuatro modelos y declarar proveedor, nivel predeterminado y opciones compatibles por modelo.
- [x] 11.2 Persistir la selección y un nivel independiente por modelo; despachar el turno al pipeline Gemini u OpenAI según el ID efectivo.
- [x] 11.3 Enviar `thinkingConfig.thinkingLevel` a Gemini y `reasoning.effort` a OpenAI, normalizando valores heredados y el override de Computer Use.
- [x] 11.4 Cubrir selector, persistencia, proveedor, esfuerzo y modelo fijo de Computer Use con pruebas; actualizar especificación y documentación.
- [x] 11.5 Retirar el modo de razonamiento “Rápido”, migrar preferencias heredadas a `low` y verificar selector y payloads de ambos proveedores.

## 12. Controles compactos, predicciones y extensiones

- [x] 12.1 Exponer selector de modelo y razonamiento en el encabezado compacto y sincronizar preferencias entre superficies montadas.
- [x] 12.2 Permitir plegar/restaurar la barra secundaria y añadir sugerencias de historial accesibles en la barra de dirección.
- [x] 12.3 Reforzar extensiones con permisos opcionales visibles, errores sin rutas y reintento explícito de cargas fallidas.
- [x] 12.4 Cubrir los flujos con pruebas, actualizar documentación y ejecutar verificación proporcional.

## 13. Favoritos y corrección de predicciones

- [x] 13.1 Evitar coincidencias por protocolo y acotar el desplegable de historial al ancho del header.
- [x] 13.2 Añadir favoritos locales saneados y accesos a extensiones instaladas en la fila secundaria existente.
- [x] 13.3 Cubrir búsqueda, persistencia, navegación, remoción y accesos de extensión con pruebas.
- [x] 13.4 Actualizar documentación, ejecutar verificación proporcional y revisar regresiones adversariales.

## 14. Predicciones superpuestas tipo navegador

- [x] 14.1 Convertir las predicciones en un menú absoluto que no desplace pestañas, favoritos ni viewport.
- [x] 14.2 Coordinar captura puntual, ocultación y restauración de la vista nativa con protección frente a carreras asíncronas.
- [x] 14.3 Cubrir apertura, selección, Escape y restauración con pruebas renderer.
- [x] 14.4 Actualizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 15. Percepción visual y DOM continua

- [x] 15.1 Definir contratos, límites y sanitización para la observación visual y DOM de la pestaña activa.
- [x] 15.2 Implementar observador serializado en main y canales IPC tipados para consultar, pausar y reanudar.
- [x] 15.3 Integrar la evidencia reciente en chat y Computer Use, tratándola como contenido no confiable.
- [x] 15.4 Añadir control visible de percepción, pruebas de privacidad/regresión y documentación operativa.

## 16. Refinamiento visual, autenticación y escala de pestañas

- [x] 16.1 Rediseñar panel flotante, selector de modelos, razonamiento y diálogos con la jerarquía de `SOFIA_DESIGN_SYSTEM.md`.
- [x] 16.2 Compactar y alinear el compositor, ampliar ligeramente Sidebar y sidecar, y cubrir la densidad responsive con pruebas.
- [x] 16.3 Corregir falsos positivos de redirección en OAuth/2FA sin relajar la allowlist del frame principal.
- [x] 16.4 Virtualizar hasta 500 pestañas lógicas con un máximo de ocho vistas vivas y restauración segura por LRU.
- [x] 16.5 Actualizar documentación, ejecutar verificación proporcional y revisión adversarial de UI, recursos y seguridad.

## 17. Referencias contextuales de la página activa

- [x] 17.1 Clasificar lecturas visibles y recursos enlazados aunque la solicitud no contenga verbos de visión.
- [x] 17.2 Solicitar observación puntual por turno y enrutar recursos enlazados a Computer Use sobre la misma sesión.
- [x] 17.3 Reforzar el prompt y cubrir Gemini/OpenAI, captura fallida y límites de seguridad con pruebas.
- [x] 17.4 Actualizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 18. Orquestación estable y navegación entre chats

- [x] 18.1 Separar el modelo conversacional elegido del actuador fijo de Computer Use y corregir el ruteo de referencias contextuales.
- [x] 18.2 Añadir un menú compacto, buscable y accesible para crear o cambiar de conversación dentro del navegador.
- [x] 18.3 Cubrir proveedor, razonamiento, acciones de conversación y cierre del popover con pruebas de regresión.
- [x] 18.4 Actualizar documentación, ejecutar verificación proporcional y revisión adversarial.

## 19. DOM y búsqueda web independientes de Computer Use

- [x] 19.1 Exponer lectura DOM saneada y navegación determinista como herramientas del orquestador sin crear canales IPC nuevos.
- [x] 19.2 Habilitar búsqueda web en OpenAI y Google grounding para referencias públicas, reservando Computer Use para interacción o fallback verificable.
- [x] 19.3 Corregir prompts y cubrir ruteo, proveedor, DOM, navegación y ausencia de invocaciones visuales con pruebas.
- [x] 19.4 Actualizar documentación, ejecutar verificación proporcional y revisión adversarial.

## 20. Geometría estable de predicciones

- [x] 20.1 Componer el desplegable de la barra de dirección por encima del chat flotante sin cambiar el flujo del header.
- [x] 20.2 Renderizar la captura temporal con los mismos insets de la vista nativa y sin `object-cover`.
- [x] 20.3 Cubrir capa, geometría y restauración con pruebas; ejecutar verificación proporcional y revisión adversarial.

## 21. Rendimiento de páginas dinámicas

- [x] 21.1 Separar captura visual pasiva de extracción DOM bajo demanda y reutilizar evidencia reciente de la misma pestaña.
- [x] 21.2 Acotar el walker DOM al viewport y reducir layouts forzados sin exponer campos sensibles.
- [x] 21.3 Aplicar un User-Agent Chromium derivado sin token Electron y conservar las preferencias de seguridad/throttling.
- [x] 21.4 Cubrir cadencia, ausencia de DOM pasivo, reutilización, compatibilidad y privacidad con pruebas; ejecutar verificación y revisión adversarial.

## 22. Ventanas separadas y presupuesto global

- [x] 22.1 Ampliar contratos y servicio main para separar/reintegrar pestañas mediante `BaseWindow` sin recarga ni nueva sesión.
- [x] 22.2 Completar handler, allowlist, preload, wrapper tipado y controles renderer con estados accesibles.
- [x] 22.3 Integrar ventanas separadas al foco del agente, visibilidad, observación y suspensión LRU con límites globales.
- [x] 22.4 Cubrir ciclo de vida, payload inválido, límite y regresiones visuales; actualizar documentación y ejecutar verificación adversarial.

## 23. Percepción adaptativa y fluidez de páginas dinámicas

- [x] 23.1 Sustituir el polling fijo por un temporizador reprogramable con ventana de calma e invalidación por actividad real.
- [x] 23.2 Reducir y codificar la evidencia pasiva dentro de un presupuesto visual sin afectar capturas explícitas ni coordenadas de Computer Use.
- [x] 23.3 Cubrir deduplicación, carga, interacción, tarea agente y resolución visual con pruebas dirigidas.
- [x] 23.4 Actualizar parámetros y arquitectura; ejecutar verificación proporcional y revisión adversarial.
