## Why

El chat ya permite adjuntar varias pestañas del navegador integrado y analizarlas juntas, pero el trabajo real del usuario vive fuera del navegador: un presupuesto en Excel, un contrato en Word, una propuesta en PowerPoint o un PDF abierto en un visor. Hoy la única forma de llevar ese contenido al chat es que el usuario lo copie a mano o adjunte el archivo, aunque la aplicación ya esté abierta frente a él y Pulse Hub ya sepa enumerar sus ventanas.

La capacidad de escritorio existente (`desktop-agent`) está orientada a **actuar** sobre la máquina paso a paso. Falta la operación inversa y mucho más barata: **leer** lo que el usuario ya tiene abierto y sumarlo al contexto de la conversación, con la misma ergonomía del selector de pestañas.

## What Changes

- Añadir al menú de herramientas del chat una opción "Añadir aplicaciones" equivalente a "Añadir pestañas", con un selector que lista las ventanas abiertas del equipo con nombre, aplicación y miniatura, y permite marcar varias.
- Abrir el selector SHALL ser instantáneo: la lista se construye solo con inventario de ventanas y miniaturas, sin leer contenido de ninguna aplicación.
- Extraer el contenido de cada aplicación marcada mediante una cascada de tres niveles que degrada sola: documento real en disco resuelto por COM y leído con el sidecar Python; árbol de accesibilidad UIA de la ventana; captura de la ventana para lectura por visión.
- Declarar siempre la procedencia y el nivel usado, tanto en el chip visible para el usuario como en el bloque de contexto que recibe el modelo, incluyendo el aviso de cambios sin guardar cuando el archivo en disco esté desactualizado respecto a la ventana.
- Adjuntar el contenido al turno como contexto, por el mismo camino que hoy usan las pestañas, sin escribir en el historial persistido ni en Supabase.
- Degradar de forma explícita fuera de Windows y cuando una aplicación no exponga contenido legible, con estados de carga, vacío, error y reintento por aplicación.
- Aplicar límites de caracteres por aplicación y por turno, y tiempos máximos por nivel de la cascada.

No objetivos: escribir, editar o guardar en las aplicaciones abiertas; ejecutar acciones sobre ellas desde este flujo, que sigue siendo competencia de `desktop-agent`; observar o transmitir el contenido de forma continua; persistir el contenido capturado; exponer al agente una herramienta runtime que liste o lea aplicaciones por iniciativa propia; alcanzar paridad de fidelidad en macOS y Linux.

## Capabilities

### New Capabilities

- `desktop-app-context`: inventario de ventanas abiertas, selección explícita por el usuario, extracción en cascada con procedencia declarada e inyección del contenido en el turno del chat.

### Modified Capabilities

Ninguna. El adjunto de pestañas del navegador no tiene hoy requisito propio en `openspec/specs/`, así que la convivencia entre ambos orígenes de contexto —área de chips compartida y límite agregado por turno— se especifica dentro de `desktop-app-context` en lugar de abrir un delta contra un requisito inexistente.

## Impact

- Electron main: nuevo servicio de contexto de escritorio que reutiliza `DesktopWindowControls.listWindows`, `desktopCapturer` con `types: ['window']` y el sidecar de documentos; nuevos módulos de resolución COM para Office y de extracción UIA por `hwnd`, sin depender de la ventana en primer plano.
- IPC/preload/renderer: canales nuevos bajo el prefijo `desktop-context:` con handler, allowlist, API de preload y wrapper tipado del renderer.
- Renderer React: selector de aplicaciones, chips de adjunto con nivel de fidelidad y estado, y ampliación del ensamblado de contexto del turno.
- Sidecar Python: se consume `documents.py` tal como está, para `.pdf`, `.xlsx`, `.xlsm`, `.pptx` y `.docx`; no se añaden formatos ni herramientas.
- Seguridad y privacidad: captura solo bajo selección explícita, exclusión de las ventanas del propio Pulse Hub, acceso COM estrictamente de lectura, sin persistencia del contenido y errores saneados.
- Documentación y pruebas: arquitectura Electron e IPC, frontend, requisitos funcionales, historias de usuario, trazabilidad, seguridad y privacidad, e inventario de pruebas.
