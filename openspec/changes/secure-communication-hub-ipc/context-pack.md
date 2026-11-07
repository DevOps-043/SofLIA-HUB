# Contexto del cambio

- Objetivo: cerrar suplantación y ausencia de fuente/sesión en los diez IPC de Communication Hub.
- Actor: usuario autenticado de Hub/Orbe; main deriva usuario y selección privada de organización.
- Alcance: schemas cerrados, DTO compartido, confirmación nativa, revocación entre esperas y efectos, historial/identidades acotados.
- No objetivos: reescribir agentes de WhatsApp/Telegram, custodiar globalmente sus conexiones o ejecutar mensajes/SQL reales durante desarrollo.
- Restricciones: conservar rama y trabajo acumulado; respaldos del delta en TEMP/soflia-communication-ipc-2026-10-30. No restaurar eliminación ajena.
- Contratos: diez canales channels existentes, servicio, preload, wrapper y arranque.
- Riesgo/HITL: envío, programación, vinculación y política/conexión requieren confirmación nativa del snapshot; I/O ya iniciado no se revierte por logout.
- Criterios: actor falso/fuente ajena sin efectos; sesión/organización A/B/A invalidan; SOFIA fallido no eleva a legacy; límites y errores públicos; cuatro capas y compuerta.
- Incertidumbres: no hay ownership acreditado del historial físico WhatsApp; no publicarlo por IPC organizacional hasta disponer de contrato verificable. Otras APIs directas siguen pendientes.
