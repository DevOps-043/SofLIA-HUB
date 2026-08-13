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

## 24. Multimedia y orquestación híbrida por superficies

- [x] 24.1 Evitar observación forzada en turnos ajenos al navegador y aplicar una cadencia de bajo impacto a YouTube y superficies multimedia.
- [x] 24.2 Permitir que el orquestador combine DOM, Computer Use browser y Computer Use desktop con superficie explícita, outcome verificable y HITL para efectos externos.
- [x] 24.3 Cubrir presupuesto multimedia, ruteo híbrido y confirmaciones con pruebas dirigidas.
- [x] 24.4 Actualizar documentación, ejecutar verificación proporcional y revisión adversarial.

## 25. Compatibilidad de Google Meet desde Chat

- [x] 25.1 Adoptar la ventana real de Meet, normalizar su User-Agent y permitir consultas provisionales de `media` sin origen sin conceder la solicitud real.
- [x] 25.2 Probar la hipótesis de colisión de payload Opus mediante un field trial documentado y cubrir permisos, ventana hija y `about:blank` con regresión; el trial se retiró al quedar refutado en 31.3.
- [x] 25.3 Sincronizar especificación, documentación de seguridad, parámetros y changelog.
- [x] 25.4 Ejecutar verificación proporcional, registrar evidencia y realizar revisión adversarial del alcance de permisos y del ajuste WebRTC.

## 26. Carrera de permisos en la ventana de Meet

- [x] 26.1 Crear y registrar la ventana hija dentro de `setWindowOpenHandler` antes de entregar su `webContents` a Chromium.
- [x] 26.2 Cubrir la consulta y solicitud de `media` previa a `did-create-window`, además del rechazo de contenido externo no registrado.
- [x] 26.3 Sincronizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 27. Iframe cruzado y service worker de Meet

- [x] 27.1 Validar consultas con `webContents = null` mediante orígenes HTTP(S) de iframe y mantener cerrada la solicitud real de dispositivos.
- [x] 27.2 Restaurar `background-sync` como capacidad automática no interactiva y cubrir contenido gobernado, iframe cruzado y entradas sin origen.
- [x] 27.3 Corregir la interpretación operativa del diagnóstico SDP, sincronizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 28. Preflight anónimo de media en Electron 43

- [x] 28.1 Permitir únicamente la consulta previa de `media` cuando Electron no entrega `webContents` ni origen, manteniendo cerrada la solicitud real de dispositivos.
- [x] 28.2 Cubrir el preflight anónimo, los orígenes explícitos inválidos y la solicitud real no registrada con pruebas de regresión.
- [x] 28.3 Sincronizar documentación, registrar el smoke real y ejecutar verificación proporcional más revisión adversarial.

## 29. Divergencia nullish del callback de permisos

- [x] 29.1 Normalizar `null` y `undefined` como identidad ausente solo para el preflight anónimo de `media`.
- [x] 29.2 Cubrir la divergencia runtime con pruebas y mantener denegados contenido no registrado, origen inválido y solicitudes reales.
- [x] 29.3 Actualizar evidencia y ejecutar verificación proporcional más revisión adversarial.

## 30. Asignación de payloads por transporte en Chromium 150

- [x] 30.1 Probar la asignación WebRTC de payload types por transporte junto al modo permisivo de validación BUNDLE; el smoke posterior la descartó como solución.
- [x] 30.2 Cubrir la composición exacta de los trials y observar la adopción síncrona de la ventana hija sin ampliar permisos.
- [x] 30.3 Registrar la evidencia que permitió refutar la hipótesis; los trials se retiran en 31.3.

## 31. Fallback compatible para llamadas directas de Google Chat

- [x] 31.1 Distinguir `meet.google.com/call` de una reunión Meet estándar y delegar únicamente la llamada directa al navegador del sistema.
- [x] 31.2 Cubrir apertura directa, navegación posterior desde `about:blank`, deduplicación, fallo externo y permanencia de reuniones normales dentro del navegador.
- [x] 31.3 Retirar los field trials experimentales sin efecto, sincronizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 32. Llamada directa cargada en un subframe

- [x] 32.1 Interceptar la ruta exacta `/call` en `will-frame-navigate` y en redirecciones de subframes, tanto en la pestaña como en el popup adoptado.
- [x] 32.2 Cubrir cancelación previa a WebRTC, deduplicación y continuidad de subframes/reuniones que no coinciden.
- [x] 32.3 Sincronizar documentación y evidencia, ejecutar verificación proporcional y revisión adversarial.

## 33. Traspaso válido de llamadas directas a Chrome

- [x] 33.1 Sustituir la apertura externa de `/call` por la conversación HTTPS iniciadora y publicar una instrucción explícita para repetir allí la llamada.
- [x] 33.2 Cubrir destino externo, deduplicación, fallo de apertura y rechazo de fuentes ajenas sin exponer parámetros de `/call`.
- [x] 33.3 Sincronizar documentación y evidencia, ejecutar verificación proporcional y revisión adversarial.

## 34. Reunión Meet estándar dentro del navegador integrado

- [x] 34.1 Retirar la apertura externa de Chrome y sustituir `/call` por `https://meet.google.com/new` en una pestaña interna de la misma sesión.
- [x] 34.2 Cubrir deduplicación, subframes, popups, fuentes ajenas y continuidad de reuniones estándar sin `shell.openExternal`.
- [x] 34.3 Sincronizar documentación y evidencia, ejecutar verificación proporcional y revisión adversarial.

## 35. Superficie compacta para la reunión alternativa

- [x] 35.1 Crear la reunión alternativa en segundo plano y presentar su misma `WebContentsView` en una ventana compacta flotante, sin activar una pestaña ni abrir otro navegador.
- [x] 35.2 Incorporar una barra arrastrable con acciones para mover la vista a una pestaña o cerrar la reunión, preservando sesión, URL y estado sin recarga.
- [x] 35.3 Cubrir deduplicación, ciclo de vida, reintegración y regresiones; sincronizar documentación y ejecutar verificación proporcional más revisión adversarial.

## 36. Apertura de Meet exclusivamente por gesto del usuario

- [x] 36.1 Registrar en un mundo aislado el clic confiable y reciente sobre el control de llamada de Gmail o Chat, consumirlo una sola vez y cancelar sin abrir ventanas cualquier `/call` automático.
- [x] 36.2 Cubrir aperturas automáticas, reintentos posteriores al cooldown, un gesto válido, consumo único y fallo cerrado de la sonda con pruebas de regresión.
- [x] 36.3 Sincronizar documentación y evidencia, ejecutar verificación proporcional y revisión adversarial.

## 37. Gesto de llamada originado dentro de iframe

- [x] 37.1 Sustituir la sonda del documento superior por la correlación entre `before-mouse-event` del `WebContents` y una baliza confiable instalada en cada frame, consumida una sola vez al interceptar `/call`.
- [x] 37.2 Cubrir el clic físico confirmado por el control dentro de cualquier frame, cada señal aislada, ausencia de gesto, clic genérico, botón distinto, vencimiento y consumo único con pruebas de regresión.
- [x] 37.3 Sincronizar especificación y documentación con la limitación oficial de la llamada directa de Chat; ejecutar verificación proporcional y revisión adversarial.

## 38. Llamada directa nativa sobre Chromium compatible

- [x] 38.1 Corregir la conclusión de compatibilidad con la evidencia de Brave y Comet, comparar sus motores con Electron y documentar que la ventana compacta pertenece a la aplicación web de Google sobre Chromium.
- [x] 38.2 Retirar la sustitución de `/call` por `meet.google.com/new`, las sondas de gesto y la barra compacta fabricada; conservar ruta, subframes, abridor, sesión y ventana hija real.
- [x] 38.3 Validar Electron 44 beta con Chromium 152 y cubrir que `/call` no se cancela ni abre un navegador externo, mientras los protocolos peligrosos siguen bloqueados.
- [x] 38.4 Instalar `44.0.0-beta.3` con la app detenida y verificar que el binario ejecuta Electron 44 / Chromium 152 con User-Agent global limpio.

## 39. Identidad Chromium completa

- [x] 39.1 Comparar el HAR de Brave con el HAR posterior a la actualización y localizar que los workers/subframes de Chat y Meet aún anunciaban el producto y `Electron/44.0.0-beta.3`.
- [x] 39.2 Normalizar el User-Agent a nivel de vista, ventana hija y sesión, consumir completo el sufijo prerelease y cubrirlo con una regresión.
- [x] 39.3 Evitar que capturas HAR bloqueadas derriben Vite, sincronizar documentación y ejecutar verificación proporcional más revisión adversarial.
- [x] 39.4 Comparar el segundo HAR y DevTools, trasladar la normalización al fallback global anterior a sesiones/workers, retirar `SharedArrayBuffer` experimental y volver a Electron `43.4.0` estable.
- [x] 39.5 Repetir el smoke sobre Electron 43.4.0: confirmó UA limpio y carga de NetEq, pero se detuvo sin `CreateMeetingDevice` ni `CreateMeetingInvite`; no cerrar la compatibilidad y trasladar la compuerta al runtime 44 limpio.

## 40. Refutación aislada de la hipótesis BUNDLE

- [x] 40.1 Configurar antes de `app.ready` únicamente `WebRTC-SdpBundlePayloadTypeCollisionCheck/Disabled/` y cubrir que no se habilita `WebRTC-PayloadTypesInTransport` ni se modifica SDP.
- [x] 40.2 Repetir el smoke con Electron `43.4.0`: el trial elimina las líneas BUNDLE pero el HAR vuelve a detenerse después de `CreateMediaSession`, sin `CreateMeetingDevice` ni `CreateMeetingInvite`; retirar la hipótesis causal.
- [x] 40.3 Retirar el trial refutado, sincronizar parámetros, evidencia y documentación operativa; ejecutar verificación proporcional y revisión adversarial.

## 41. Chromium 152 con identidad global limpia

- [x] 41.1 Reinstalar exactamente Electron `44.0.0-beta.3` con la aplicación detenida y comprobar el binario `44.0.0-beta.3` / Chromium `152.0.7977.30`.
- [x] 41.2 Ejecutar el smoke sobre Chromium 152: volvió a fallar con `StartupCode 219` sin `CreateMeetingDevice` ni `CreateMeetingInvite`, por lo que se refuta la ventana compacta como ruta de producto.

## 42. Fallback de llamada directa en pestaña interna

- [x] 42.1 Transferir la URL `/call` completa a una pestaña interna activa cuando Chat la entregue directamente, mediante navegación/subframe o después de `about:blank`.
- [x] 42.2 Reutilizar la pestaña para eventos repetidos, conservar Document Picture-in-Picture y protocolos gobernados, y cubrir las rutas con regresiones de servicio.
- [x] 42.3 Sincronizar especificación, arquitectura y operación, y ejecutar verificación automatizada proporcional.
- [x] 42.4 Cancelar la validación de timbrado: el usuario retiró la capacidad por aperturas aleatorias y no se ejecutarán más llamadas reales.

## 43. Retirada definitiva de Google Meet directo

- [x] 43.1 Eliminar creación, transferencia, deduplicación y activación de pestañas `/call`, además de la observación de RPC de Meet.
- [x] 43.2 Bloquear la ruta directa automática originada por Gmail o Chat en popup, navegación, redirección, subframe y transición desde `about:blank`, sin tocar permisos generales.
- [x] 43.3 Sustituir las regresiones de creación por pruebas negativas que exigen cero pestañas y cero reuniones nuevas.
- [x] 43.4 Sincronizar arquitectura, operación y evidencia; ejecutar verificación proporcional y revisión adversarial.
