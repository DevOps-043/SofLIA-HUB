# Avatar SofLIA 2D interactivo

## Why

La orbe actual usa Canvas, OrbMesh, shaders y geometría Three.js. El diseño aprobado es una imagen concreta cuya identidad se pierde al reconstruirla con geometría. La ventana de voz y el instalador comparten OrbCanvas, por lo que ambos deben cambiar juntos sin alterar sus contratos.

## What Changes

- Composición 2D del recurso original, con cuerpo transparente, ojos recuperados y máscaras luminosas.
- Controlador de mirada, parpadeo, gestos, expresiones y amplitud, con un único bucle visual por instancia.
- Fachada OrbCanvas compatible; conserva análisis existente de entrada/salida y contratos de voz e instalador.
- Demostración aislada, exportaciones derivadas, pruebas y documentación.

## Impact

Renderer e instalador; sin cambios IPC, datos, permisos ni dependencias. El código 3D anterior se conserva fuera de la ruta de render como referencia de reversión durante la validación. Three.js deja de cargarse por este avatar.
