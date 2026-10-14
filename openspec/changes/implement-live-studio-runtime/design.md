## Contexto y decisión
Learning ya verifica bearer, organización y acceso académico; mantiene esa autoridad. Hub conserva tokens en main. Se crea una API studio separada del contrato anterior del aula. Estado acotado de sesión con revisión, comandos idempotentes y escritura compare-and-swap transaccional; las invalidaciones Realtime contienen únicamente sesión/revisión y obligan a releer el snapshot autorizado.

Zoom Meeting SDK es el proveedor confirmado por el usuario. Sus credenciales SDK son distintas del OAuth Server-to-Server existente. Firma y ZAK se generan exclusivamente en Learning; no se transmiten secretos de aplicación. Los permisos de host derivan del servidor, nunca de un selector de UI. El banco del instructor contiene escenas locales de producción. Learning conserva contenido académico; no confirma ni conoce vínculos a ventanas/pestañas del equipo.

## Fronteras
- El contrato previsto para Engine es un manifiesto versionado de escenas, materiales, prácticas y quizzes. Esta fase implementa su importación manual; la publicación automática desde Engine sigue pendiente. Learning valida curso, rol, límites y revisión; conserva una copia para la sesión. No se ejecuta HTML o código del manifiesto.
- Salas académicas y salas audiovisuales Zoom tienen estados separados: ninguna asignación local acredita traslado audiovisual.
- Dispositivos se enumeran desde MediaDevices; captura requiere acción humana y se libera al salir. La reunión SDK posee sus propios dispositivos durante la conexión para evitar captura duplicada.
- No IA sin consentimiento vigente. Moderación, pertenencia a sala y respuestas se validan en servidor.

Meeting SDK se compila en un paquete aislado con React 18 y carga desde el protocolo local `soflia-zoom://meeting`, sin acceso al preload del renderer React 19. El smoke nativo verifica la carga y la CSP.

## Seguridad y recuperación
Tablas privadas sin acceso directo authenticated; solo la tabla de revisiones tiene SELECT con RLS académico. Sin DELETE Realtime. Idempotencia por actor/sesión/comando y revisión optimista impiden duplicados y actualizaciones perdidas. Presencia se fusiona por actor en SQL y no invalida a otros clientes cuando solo renueva el lease. Realtime recupera al reconectar; errores visibles y reintento manual. Ninguna credencial se persiste en renderer.

## Selector de pantalla propio (2026-10-13)
El cuadro nativo de botones se sustituye por un renderer React mínimo dentro de
una ventana modal sin marco. Reutiliza el entrypoint, bundle preload y tokens del
Hub, pero el argumento main `--display-media-picker` expone solo tres métodos
allowlisted. Los handlers autorizan por webContents y frame exactos, nunca por
query string. Inventario y objetos de captura permanecen en main; las miniaturas
solo llegan al selector local. El renderer solicitante no recibe inventario.
Pantallas/ventanas se reenumeran al confirmar. Las pestañas se obtienen de vistas
materializadas del perfil actual (sin pestañas sensibles ni control de agente),
se capturan con WebFrameMain y se rechazan si cambian documento o perfil.
No se enumeran pestañas de aplicaciones externas. No se añade dependencia,
polling, protocolo, almacenamiento ni ruta de captura paralela.
El cambio continúa en la rama aislada `codex/live-studio-runtime` porque consume
la implementación no confirmada del estudio; no se traslada ni descarta su estado.

## Escenas locales ligadas a fuentes (2026-10-13)
Las escenas se crean localmente, incluidos medios mediante URLs blob con dueño.
El selector propio tiene un modo Vincular que prepara consentimiento sin emitir.
Main custodia concesiones UUID de fuentes concretas, ligadas a ventana y actor;
el renderer conserva solo metadatos de esa concesión. Activar una escena elige la
fuente para Zoom; un permiso de vista previa de un solo uso permite al renderer
abrir su captura sin repetir el selector. No cambia la ruta de audio loopback.
Una pestaña vinculada sigue su navegación mientras exista la misma vista y perfil.
No se recupera una fuente por nombre ni se sustituye una fuente desaparecida.
La API pública EmbeddedClient de Meeting SDK no ofrece iniciar ni cambiar pantalla;
el control oficial Compartir inicia la transmisión de la fuente activa. El runtime
posee las pistas que obtiene del navegador y permite detenerlas desde el dock o al
cambiar de escena. La nueva fuente se transmite al volver a pulsar Compartir en Zoom.
No se usan selectores DOM privados del SDK ni métodos inventados.

## Despliegue
Preparar migración y endpoints en el checkout Learning; verificación local antes de aplicar/publicar. No aplicar SQL remoto en este cambio. SDK requiere configurar credenciales y permiso ZAK de la cuenta maestra. Rollback: volver a Hub anterior y deshabilitar rutas studio; conservar datos para recuperación.
