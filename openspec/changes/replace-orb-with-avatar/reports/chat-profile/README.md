# Perfil único del chat — 12 de noviembre de 2026

El usuario solicitó ampliar el personaje junto a la respuesta y trasladar ahí
las expresiones, eliminando el personaje adicional situado sobre el compositor.

El `ChatUI` compartido por chat principal, navegador y proyectos deja de montar
la presencia inferior. `MessageList` entrega los gestos al perfil de la última
respuesta; durante el marcador de carga los entrega exclusivamente al indicador
de espera. El historial conserva imágenes estáticas. El mismo proveedor mantiene
dictado, resultados, errores, borradores, reposo y permisos.

El perfil mide 88 px en escritorio y 72 px en móvil/flotante, con el rostro
luminoso aprobado. La columna de la respuesta es flexible para conservar el
ancho disponible. No se cambia la foto de usuario ni las acciones del mensaje.

## Evidencia

- 59 pruebas aprobadas en cinco archivos: turno real con proveedor simulado,
  avatar, presencia, trabajos en segundo plano y compositor.
- Se verificó un solo perfil animado con historial, reacción al borrador en el
  perfil, ausencia de la presencia inferior y transición espera/respuesta.
- Typecheck y lint incremental aprobados.
- Cuatro comprobaciones de Chrome aprobadas, sin errores de página, usando
  `MessageList` y el avatar productivos en una fixture sin sesión ni servicios
  reales. Incluyen cinco expresiones, tamaños 88/72 px, ancho de 390 px sin
  desbordamiento y movimiento reducido.
- `verify:pr` se detuvo en el mismo inventario documental preexistente:
  declara 716 archivos de prueba, pero el validador cuenta 715. No se añadieron
  ni retiraron archivos de pruebas automatizadas con este cambio.

[Resultados](browser-qa.json), [escritorio](desktop.png),
[flotante](floating.png) y [móvil](mobile.png).

Para reproducir, iniciar desde la raíz del repositorio:

```powershell
node node_modules/vite/bin/vite.js --config test/manual/soflia-avatar/integration.vite.config.mts --port 4333
```

En otra terminal:

```powershell
node test/manual/soflia-avatar/verify-chat-profile.mjs
```

Revisión adversarial local: los mensajes antiguos no crean motores de animación,
el marcador de espera no duplica al perfil activo y la respuesta no desborda en
móvil. Las pruebas existentes de cambio de conversación y cancelación siguen
aprobadas. No cambian voz, permisos, persistencia ni IPC. La reversión se limita
al commit de presentación.
