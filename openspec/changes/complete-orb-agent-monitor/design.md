## Context

Ver motivación y alcance en proposal.md. La Orbe usa el pipeline común y preload de la aplicación; el monitor auxiliar tiene un preload restringido. La identidad de autenticación vive en el contexto del renderer y se contrasta en main.

## Goals / Non-Goals

Mantener la procedencia de cada evento incluso si dos superficies publican el mismo UUID. No ampliar herramientas ni compartir contenido de conversaciones.

## Decisions

- Inyectar getOrbWindow desde el estado nativo: no confiar en URL, nombre o superficie recibidos en el payload.
- Autorizar publicación desde los frames principales de Hub y Orbe actuales. El monitor continúa autorizado solo para consulta y controles.
- Usar origen orb en el almacén y forzar surface orb en main; Hub conserva origen renderer y superficie chat. Así el renderer no puede suplantar eventos de main.
- Capturar user.id en las opciones del turno de voz; los callbacks no consultan un usuario posterior para etiquetar una ejecución anterior.
- Reutilizar los tres canales, allowlist, preload y wrapper tipado existentes; evitar un segundo puente para la Orbe.

## Risks / Trade-offs

- Eventos tardíos → validación de propietario y secuencias; limpiar al cambiar sesión.
- Ventana reemplazada o subframe → comprobar identidad de webContents y mainFrame en cada llamada.
- Es metadato visual efímero, no evidencia de ejecución de herramientas; se conserva el límite de doce equipos y no se agrega persistencia.

## Migration Plan

Sin migración. Desplegar con el build habitual. Revertir el commit restaura el monitor anterior sin tocar datos ni claves. Verificación focalizada, compuerta PR y build del renderer.
