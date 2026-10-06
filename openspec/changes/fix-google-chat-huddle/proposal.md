## Why

Main cancela `meet.google.com/call` desde Gmail/Chat, una barrera confirmada para
Huddle. Retirarla dejó visible otro fallo de arranque. Una versión estable y una
prueba sin service workers también fallaron; la sonda nativa separada confirma
una API PiP expuesta sin ventana real. El usuario autoriza recuperar las llamadas y probarlas con las cuentas
de Alexis o DevOps; la retirada histórica del 2026-08-13 queda sustituida.

## What Changes

- Permitir el componente embebido de Meet bajo la gobernanza de red existente.
- Conservar ventanas reales, sesión y `window.opener` para la ruta exacta de
  llamada de Chat, en lugar de cancelarla o convertirla en pestaña.
- Mantener permisos por origen, certificados, aislamiento y política empresarial.
- Verificar llamadas reales y documentar cualquier fallo del proveedor que siga
  presente después de retirar la barrera local.

No objetivos: crear reuniones alternativas, simular tarjetas o timbrado, abrir
un navegador externo, modificar SDP o conceder dispositivos globalmente.
Actualizar Electron por sí solo no resolvió la llamada. Tras validar la
corrección de capacidades, se alinea la instalación con 44.5.1 estable probado.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `integrated-agent-browser`: compatibilidad nativa con llamadas de Google Chat
  sin automatismos de creación de reuniones propios de SofLIA.

## Impact

Servicio main del navegador, pruebas del servicio y smoke nativo, documentación
y especificaciones. No cambian IPC ni persistencia. Electron queda fijado en
44.5.1 estable. Se oculta una capacidad PiP incompleta bajo APIs públicas;
el empaquetado de release queda fuera de esta prueba.
