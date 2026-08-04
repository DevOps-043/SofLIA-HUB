## Why

Pulse Hub hoy puede automatizar un navegador Playwright oculto o el navegador externo del sistema, pero el usuario no dispone de una superficie web integrada que comparta sesión, estado visible y control con el agente. Esto impide una colaboración verificable como la de Codex: el usuario no puede observar o retomar en SofLIA lo que hace el agente, y el agente no puede continuar sobre una página que el usuario ya abrió dentro del producto.

## What Changes

- Añadir una vista de navegador integrada al workspace de SofLIA, con barra de dirección, navegación atrás/adelante, recarga/detención y estado de carga/error.
- Mantener una sesión Chromium persistente y aislada de la UI de SofLIA, sin importar cookies, contraseñas ni perfiles de navegadores externos.
- Permitir que `use_computer` abra el navegador integrado, observe exactamente la página visible y actúe sobre ella mediante capturas y eventos de entrada.
- Exponer un contrato IPC cerrado y tipado para ciclo de vida, navegación, viewport y eventos de estado.
- Denegar protocolos peligrosos y capacidades web no declaradas; solicitar aprobación humana para cámara, micrófono o ubicación.
- Cubrir servicio, handler, allowlist/preload, wrapper, renderer, integración del agente, documentación y casos negativos.

No objetivos: múltiples pestañas, extensiones de Chrome, DevTools, importación de perfiles externos, control desde grupos de WhatsApp ni sustituir el navegador predeterminado del sistema.

## Capabilities

### New Capabilities

- `integrated-agent-browser`: navegación web embebida, persistente y segura que usuario y agente runtime comparten en la misma superficie visible.

### Modified Capabilities

Ninguna; no existen specs base publicadas para navegación integrada o Computer Use.

## Impact

Afecta el bootstrap y ciclo de vida de Electron, un servicio main nuevo basado en `WebContentsView`, handlers `integrated-browser:*`, allowlist y API de preload, tipos/wrapper del renderer, navegación principal/Sidebar y el backend browser del agente de escritorio. Actualiza el manual runtime, la arquitectura Electron/IPC, parámetros y catálogo de pantallas. No agrega dependencias, tablas, migraciones ni secretos. El estado web queda en la partición persistente propia de Electron y el rollback consiste en retirar la vista/canales y volver al backend Playwright existente.
