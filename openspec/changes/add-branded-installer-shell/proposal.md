## Why

El usuario rechazó el asistente NSIS porque cambiar sus imágenes conserva la ventana genérica. Solicita una experiencia propia, animada, con el logo original y una orbe tridimensional.

## What Changes

- Incorporar una ventana Windows independiente, sin páginas ni marco del asistente clásico, con `public/assets/Icono.png` y una escena 3D animada.
- Conectar la interfaz al paquete NSIS existente en modo silencioso, con consentimiento, progreso honesto y errores recuperables.
- Generar un ejecutable de entrada distinto del artefacto de actualización para conservar `electron-updater`.
- Incorporar previsualización segura, pruebas y documentación operativa.
- No objetivos: instalar sobre este equipo, publicar, firmar, cambiar actualizador, migraciones o recrear el logo.

## Capabilities

### New Capabilities

- `branded-installer-shell`: interfaz de instalación propia y ejecución acotada del motor existente.

### Modified Capabilities

Ninguna; se conserva el contrato del actualizador existente.

## Impact

Nuevo bootstrapper WPF compilado con .NET Framework de Windows, scripts de empaquetado y pruebas. Sin dependencias npm nuevas, IPC Electron, red, credenciales ni cambios de datos. El instalador modifica archivos y registro únicamente tras pulsar Instalar.
