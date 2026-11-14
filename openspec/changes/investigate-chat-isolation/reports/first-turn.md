# Verificación del primer turno

Base `0a10deaa`. El primer guardado cambia `currentConversationId` de `null`
al UUID reservado. La clave anterior del visor de artefactos cambiaba con
ese valor y remontaba la vista completa. El desmontaje del procesador abortaba
el turno supervisado aunque el mensaje del usuario ya estuviera guardado.

La clave usa ahora el ámbito estable del borrador junto con la identidad y la
organización. El visor sigue reiniciándose al cambiar de ámbito.

- La regresión de montaje falló con el código original y pasó con el cambio.
- Pasaron 37 pruebas dirigidas en siete archivos, incluidos navegación,
  persistencia, permisos de chats de proyecto, visor y resolución de turnos.
- Pasaron lint incremental, arnés, enlaces de documentación y OpenSpec.
- Pasó TypeScript para `tsconfig.json` y `tsconfig.node.json` con el SDK de
  Zoom ya instalado en el checkout principal, reutilizado en el worktree.
- `npm run verify:pr` se detuvo en `test:quality` por fallos de infraestructura
  en enlaces de Windows, loopback y resolución de un fixture temporal de Vite.
  La prueba de enlaces de Electron también falla en el checkout original.

## Integración en el checkout de desarrollo

La corrección se aplicó en el checkout principal tras comprobar que sus archivos
no contenían ediciones locales. Se repitieron allí las 37 pruebas dirigidas y
`git diff --check`, con resultado satisfactorio. La revisión automática bloqueó
la recarga de la instancia Electron abierta para preservar su sesión y el
posible estado sin guardar. Queda pendiente un primer envío con el código
recargado y un proveedor real.
