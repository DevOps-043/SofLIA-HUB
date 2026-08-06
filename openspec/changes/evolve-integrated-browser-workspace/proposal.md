## Why

La vista integrada actual reemplaza todo el workspace de chat y no ofrece administración de navegación, credenciales o extensiones. Para colaborar como en Codex, el usuario necesita conversar con SofLIA mientras observa o retoma el navegador en una superficie lateral ajustable, con persistencia útil pero gobernada.

## What Changes

- Optimizar páginas dinámicas y multimedia separando la captura visual pasiva de la extracción DOM bajo demanda, reduciendo su frecuencia y presentando un User-Agent Chromium compatible sin relajar sandbox, aislamiento ni throttling de pestañas ocultas.
- Hacer adaptativa la percepción pasiva: comprimir una copia visual acotada, esperar a que termine la interacción y evitar capturas redundantes durante cargas, Computer Use o cambios rápidos del viewport.
- Aplicar un perfil de observación de bajo impacto a superficies multimedia como YouTube: ampliar la cadencia y la calma tras interacciones asíncronas, y no forzar captura/DOM en turnos que no se refieren al navegador.
- Corregir la composición visual de las predicciones: el menú debe quedar por encima del chat flotante y la captura temporal debe conservar exactamente los insets de la vista nativa, sin ampliar ni desplazar la página.
- Convertir Navegador en la superficie completa del workspace y superponer un chat compacto, redimensionable y colapsable con SofLIA sin reducir el viewport web.
- Permitir separar pestañas en ventanas nativas independientes y reintegrarlas sin recargar, conservando la misma sesión y el presupuesto global de vistas Chromium.
- Sustituir temporalmente la Sidebar de chats/carpetas por ese chat flotante mientras el modo navegador está abierto; restaurarla sin perder estado al cerrar.
- Añadir historial local persistente, paginado, buscable y borrable con URLs saneadas y retención acotada.
- Añadir una bóveda de credenciales por origen cifrada mediante `safeStorage`; listar solo metadata y rellenar directamente en el `WebContentsView` mediante gesto explícito del usuario.
- Añadir un gestor de extensiones desempaquetadas compatibles con Electron, con validación de manifest, permisos visibles, confirmación HITL, carga por sesión y recuperación al reiniciar.
- Ampliar el contrato IPC cerrado, las pruebas, documentación de seguridad/UX y evidencia del cambio.
- Mejorar la barra superior y el divisor del workspace con controles reconocibles, áreas de interacción amplias y feedback visible durante el redimensionamiento.
- Hacer que las referencias del usuario a "lo que estoy viendo" activen una inspección real del navegador integrado y que las acciones web reutilicen esa misma página y sesión.
- Migrar historial, contraseñas y extensiones a una superficie flotante redondeada sobre la vista del navegador, con confirmaciones renderer premium alineadas a `SOFIA_DESIGN_SYSTEM.md` en lugar de cuadros nativos del sistema.
- Mantener el `WebContentsView` vivo en el área no obstruida y alinear el panel de SofLIA con el inicio real del contenido web, sin cubrir la barra superior del navegador.
- Fijar Computer Use en `gemini-3.6-flash` sin degradación silenciosa, conservando SofLIA, SofLIA Max, SofLIA Pro y SofLIA Lite en el selector conversacional.
- Hacer efectiva la selección de modelo y razonamiento: SofLIA/Lite usan Gemini, Max/Pro usan OpenAI y cada modelo conserva un nivel compatible, sin exponer un modo sin razonamiento.
- Ampliar el presupuesto de tareas web largas de forma acotada para que autenticaciones y flujos multipaso no terminen prematuramente; la ejecución sigue finalizando en cuanto el modelo completa la tarea.
- Incorporar hasta 500 pestañas lógicas internas con un presupuesto acotado de vistas nativas vivas, convertir ventanas emergentes HTTP(S) en pestañas gobernadas y permitir dos vistas vivas en modo dividido o con una secundaria superpuesta.
- Compactar la barra del asistente y su compositor, y permitir sustituir temporalmente el chat por la Orbe general movible sin perder la conversación.
- Permitir cambiar modelo y razonamiento desde el chat compacto, plegar la barra secundaria del navegador y sugerir destinos recientes desde la barra de dirección.
- Reforzar el gestor de extensiones mostrando todos los permisos declarados, permitiendo reintentos explícitos y evitando filtrar rutas locales en errores.
- Corregir las predicciones para que no coincidan por el protocolo `https://` y se superpongan como un menú flotante bajo la barra de dirección, sin desplazar pestañas, favoritos ni página; la vista nativa se sustituye solo durante el menú por una captura puntual de la misma sesión.
- Incorporar favoritos locales y accesos a extensiones instaladas dentro de la misma fila secundaria del título y los gestores.
- Incorporar percepción continua y acotada de la pestaña activa mediante una captura visual y un snapshot DOM semántico saneado en memoria, con indicador y pausa explícita, para que SofLIA entienda el estado actual antes de responder o actuar.
- Rediseñar el chat, selectores y diálogos con la jerarquía tipográfica y densidad de `SOFIA_DESIGN_SYSTEM.md`, incluyendo un selector de razonamiento en filas tipo Codex y un compositor simétrico de menor altura.
- Corregir falsos positivos de seguridad en redirecciones secundarias de autenticación sin permitir que protocolos no confiables naveguen el frame principal.

- Resolver referencias contextuales a mensajes, personas y recursos de la pestaña activa aunque el usuario no use verbos visuales. La lectura usa primero el DOM saneado y búsqueda web/URL Context; navegar directamente a un destino conocido usa el contrato determinista del navegador y Computer Use queda reservado para interacción visual, contenido autenticado no accesible por lectura o fallos de las rutas de solo lectura.
- Conservar el modelo y razonamiento elegidos como orquestador del turno aunque necesite Computer Use; solo el actuador visual interno queda fijado en `gemini-3.6-flash`.
- Permitir planes híbridos explícitos dentro del mismo turno: leer DOM o controlar la pestaña integrada, observar una aplicación de escritorio con Computer Use y volver al navegador para completar el flujo. Cada paso conserva su superficie declarada y los envíos, publicaciones o acciones irreversibles mantienen confirmación HITL.
- Permitir que SofLIA Max y Pro usen `web_search` alojado de OpenAI y el DOM del navegador integrado sin sustituir el proveedor ni iniciar Computer Use; SofLIA y Lite conservan Google Search/URL Context con el mismo criterio.
- Permitir crear una conversación o cambiar a otra desde el encabezado compacto del navegador mediante un menú flotante buscable, sin restaurar la Sidebar completa.

No objetivos: Chrome Web Store o `.crx`, compatibilidad completa con Chrome, sincronización cloud, captura automática de contraseñas, lectura de valores escritos en formularios, vigilancia del escritorio, inferencia continua sin un turno del usuario o una tarea activa, autofill iniciado por el modelo o ejecución de extensiones sin aprobación. Las ventanas separadas no incorporan un renderer de aplicación, perfil o proceso de agente adicional.

## Capabilities

### New Capabilities

- `browser-sidecar-workspace`: navegador a ancho completo con chat compacto flotante, ajustable y colapsable.
- `browser-history`: registro local acotado, consulta, búsqueda, reapertura y borrado explícito de navegación.
- `browser-credential-vault`: almacenamiento cifrado por origen y llenado explícito sin devolver secretos al renderer o al agente.
- `browser-extension-management`: importación, validación, confirmación, carga persistida y remoción de extensiones desempaquetadas compatibles.

### Modified Capabilities

- `integrated-agent-browser`: la vista deja de ser una sección exclusiva y pasa a operar como superficie completa compartida bajo overlays renderer, conservando captura y control del agente.

## Impact

Afecta el layout de `AppContent`/`AppWorkspace`/`AppSidebar`, componentes de navegador y chat, estado de preferencias, `IntegratedBrowserService`, nuevos stores locales bajo `userData`, handlers y canales `integrated-browser:*`, preload/wrapper, mocks Electron y pruebas main/renderer. No agrega dependencias ni migraciones Supabase. Historial y metadata de extensiones se guardan en JSON local; las contraseñas se almacenan únicamente cifradas por el proveedor seguro del sistema operativo. El rollback permite desactivar el sidecar y sus gestores conservando el navegador base.
