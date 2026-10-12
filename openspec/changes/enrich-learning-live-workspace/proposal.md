# Enriquecer el aula de Learning en Hub

## Why

La propuesta Zoom-Soflia V2 del 10 de octubre amplía las sesiones hacia colaboración y prácticas. La arquitectura vigente ejecuta reuniones y webinars en el navegador de Hub; un cambio a Video SDK no es intercambiable con esos recursos.

## What Changes

- Antesala nativa, entrada explícita a Zoom y espacio educativo de escritorio.
- Chat, preguntas con votos, prácticas con revisión entre pares y solicitudes de ayuda contextualizadas.
- Pulse Checks persistentes y métricas agregadas declaradas por los alumnos.
- FAQ configurada por instructor, con respuesta privada y sin publicación duplicada.
- Política organizacional, consentimiento versionado, retención y eventos xAPI mínimos.
- Contratos y requisitos verificables para RTMS, LTI y Computer Use; permanecen cerrados hasta disponer de proveedores y autorización real.

## Capabilities

### New Capabilities

- `learning-live-workspace`: colaboración educativa autenticada en Hub.

## Impact

Learning mantiene autorización académica y persistencia SOFIA. Hub usa main/handler/preload/wrapper para acceder a HTTP; no recibe tokens administrativos. Se preservan los cambios existentes y el cliente Zoom. Migración aditiva local, sin despliegue remoto ni nuevas dependencias del producto.
