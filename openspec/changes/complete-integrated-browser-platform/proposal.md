## Why

El navegador integrado ya comparte sesión, contexto y control con SofLIA, pero todavía carece de funciones cotidianas necesarias para usarse como superficie principal de trabajo y de controles suficientes para gobernar un agente sobre datos sensibles. El cambio completa esa base sin intentar convertir Electron en un clon de Chrome ni prometer compatibilidad que el runtime no ofrece.

## What Changes

- Completar navegación cotidiana: descargas, búsqueda en página, zoom, impresión/PDF, silencio por pestaña, reapertura, restauración de sesión, grupos, pestañas fijadas y vista vertical opcional.
- Añadir perfiles navegables normal, privado e invitado, con importación controlada de datos y aislamiento de particiones.
- Evolucionar marcadores, historial y credenciales a stores main por perfil con búsqueda, organización, importación/exportación, generador de contraseñas, salud de credenciales y preparación para passkeys sin exponer secretos al renderer ni al agente.
- Incorporar protección por sitio contra rastreadores, anuncios invasivos, parámetros de seguimiento y fingerprinting, con excepciones, métricas locales y navegación segura.
- Reforzar el agente embebido con selección explícita de pestañas, fuentes citables, política por sitio, modos estricto/equilibrado, permitir una vez/siempre, toma de control, bitácora, atajos reutilizables y memoria semántica opt-in.
- Añadir sincronización cifrada y selectiva de marcadores, grupos, ajustes y pestañas; las credenciales quedan fuera hasta disponer de recuperación y autenticación fuerte verificadas.
- Crear políticas empresariales locales para restringir sitios, capacidades del agente, extensiones y retención, además de telemetría exportable sin contenido sensible.
- Mantener extensiones como catálogo curado de paquetes desempaquetados compatibles con Electron, con permisos por sitio; Chrome Web Store y CRX continúan fuera de alcance.
- Establecer un ciclo de actualización del motor con versión estable, reporte de runtime y compuerta que impida publicar una beta accidentalmente.

No objetivos: sustituir Chrome, Edge o Brave como navegador predeterminado del sistema; compatibilidad completa con Chrome Web Store; sincronizar contraseñas sin recuperación y autenticación fuerte; registrar contenido completo, secretos o capturas en telemetría; permitir que SofLIA lea la bóveda de credenciales.

## Capabilities

### New Capabilities

- `browser-productivity-tools`: descargas, búsqueda, zoom, impresión, restauración y organización avanzada de pestañas.
- `browser-profile-data`: perfiles normal/privado/invitado, marcadores, historial, importación y gestión avanzada de credenciales.
- `browser-privacy-protection`: bloqueo de rastreo, navegación segura, excepciones y reporte local por sitio.
- `browser-agent-governance`: permisos por sitio, trazabilidad, fuentes, toma de control, atajos y memoria opcional del agente.
- `browser-encrypted-sync`: sincronización selectiva cifrada, conflictos, revocación y recuperación para datos no secretos.
- `browser-enterprise-controls`: políticas administrables, retención, restricciones y telemetría saneada.
- `browser-runtime-lifecycle`: versión estable del motor, actualización, diagnóstico y compuertas de release.

### Modified Capabilities

Ninguna especificación base publicada cambia; las capacidades anteriores del navegador siguen en cambios OpenSpec aún no archivados y este cambio se integra sobre sus contratos implementados.

## Impact

Afecta `electron/integrated-browser/`, sus handlers, preload, allowlists y wrappers; componentes React del navegador; stores locales por perfil; herramientas del agente; Project Hub; configuración empresarial; actualizador, empaquetado y documentación. Añade IPC cerrados y pruebas main/renderer, pero no ejecuta migraciones remotas ni modifica secretos. La sincronización remota requiere un backend explícito y queda desactivada por defecto hasta que exista configuración válida, RLS y verificación end-to-end.
