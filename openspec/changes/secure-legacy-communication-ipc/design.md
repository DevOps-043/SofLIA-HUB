## Context

El lote 48 protege channels pero las rutas activas antiguas tienen sus propios
registros. El dispositivo mantiene transportes e historial globales; no hay
ownership por cuenta acreditado para inventar filtros de datos físicos.

## Goals / Non-Goals

Unificar fuente/actor, rol, aprobación y recursos de las tres familias; conservar
las cuatro capas. No afirmar custodia integral, aislamiento de transporte por
organización, RLS, GUI o proveedores reales durante pruebas locales.

## Decisions

- Extraer el gateway del lote 48 y compartirlo por instancia de servicio mediante
  WeakMap: ocho plazas físicas y una aprobación para los 25 canales.
- WhatsApp queda en su handler canónico registrado por service-ipc; Telegram
  también recibe servicio/ventanas reales. Se eliminan registros/eventos duplicados.
- Administración física exige usuario/organización main y owner/admin SOFIA.
  Mutaciones tienen snapshot/HITL y rol revalidado; callbacks de transporte
  permanecen fuera de AsyncLocalStorage temporal. Historias/chats globales se
  presentan como administración del dispositivo, sin inventar propietario.
- Eventos sólo a viewers que hayan consultado estado autorizadamente; cada
  emisión revalida fuente, sesión, organización y rol antes de publicar. Viewers
  acotados y revocables; cada publicación tiene el deadline del gateway. No se
  necesita polling ni aprobación cacheada de rol: se consulta antes de cada evento.
  El coalescer no acumula eventos sin límite.
- Enums requieren string real, listas/JSON/textos tienen límites compartidos.
  DTO frontend extraído a shared; ninguna implementación depende de componentes.
- El panel no guarda la clave al abrir; sólo al conectar explícitamente y si
  la aprobación/persistencia tienen éxito. Errores/cancelaciones no modifican UI
  como si hubieran triunfado; carga obsoleta se descarta al cerrar/cambiar actor.

## Risks / Trade-offs

Owner/admin es administración del dispositivo compartido, no prueba ownership
de cada conversación/conexión. Datos físicos, runtime entrante y cifrado de sus
archivos conservan límites. I/O ya iniciado no se revierte ni se reintenta por
perder respuesta. Revisión independiente y GUI real pendientes antes de archivar.

## Migration Plan

Cambiar startup, handlers y preload juntos sin nuevos canales. Revertir sólo
delta respaldado respecto al lote 48; no tocar índice, secretos o SQL remotos.
