# Agenda y aula de sesiones síncronas

## Why
El usuario necesita consultar sus próximas clases desde Herramientas Integradas y participar dentro de Hub. El aula actual apila controles y contenido en una sola columna sin jerarquía.

## What Changes
- Entrada Sesiones síncronas debajo de Navegador y Reuniones.
- Agenda paginada y autenticada de Learning, próxima sesión destacada y apertura explícita del aula.
- Aula como lienzo vacío, con controles mínimos para volver a la agenda o cerrar. Se retira la interfaz anterior de participación, Pulse Checks e información por solicitud del usuario del 11 de octubre.
- El aula ocupa su propia vista y no activa el navegador, el chat, agentes ni medios Zoom.

## Impact
Renderer, contrato IPC de catálogo y endpoint Learning que reutiliza live_catalog y autorización académica. Sin cambios de esquema ni acceso Zoom en renderer.
