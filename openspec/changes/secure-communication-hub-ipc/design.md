## Context

El servicio recibe actores explícitos de IPC y también resuelve remitentes de
agentes runtime. Son planos distintos: el contexto IPC se deriva en main sin
convertir hints del renderer en autoridad ni eliminar la resolución runtime.

## Goals / Non-Goals

Cerrar las diez entradas con DTO, snapshot, fuente y sesión. No acreditar
ownership del transporte físico global, RLS ni revocación de envíos ya iniciados.

## Decisions

- trustedAppCaller con ventanas reales y revisión privada de organización captura
  A/B/A. El handler acepta hints iguales y rechaza discrepancias/keys ajenas.
- AsyncLocalStorage transmite actor/assert/confirm sólo a la llamada IPC. El
  servicio exige principal SOFIA activo coincidente y revalida al leer/mutar estado
  o invocar efectos. Sin contexto IPC, el plano runtime conserva su autorización.
- nativeConfirmation serializa aprobación, usa señal y deadline existentes y
  muestra snapshot sin claves. Se revalida antes/después de cada espera.
- SOFIA vuelve a consultarse tras confirmar: rol/organización diferentes niegan
  el efecto. El transporte y la creación de clientes persistentes usan exit del
  contexto temporal; su polling no hereda una lease que cerrará al responder.
- Ocho operaciones físicas; señal de 180 segundos al SDK y respuesta JSON de
  256 KiB. Una consulta que ignora cancelación retiene la plaza hasta resolver.
  Los límites viven en el DTO compartido, sin overrides del renderer.
- Schemas JSON de 128 KiB, texto 16 KiB, listas 100 y horarios válidos/futuros.
  Errores públicos fijos. No usar handleIPC que publica mensajes del proveedor.
- Enums requieren strings reales: String(array) aceptaba arrays y permitía
  saltar la guarda de grupos. Se reprodujo también en OpenAI (tres casos rojos)
  y se unificó el chequeo en bounded-json, sin cambiar opciones legítimas.
- Historial/identidades IPC se filtran por organización; eventos personales sólo
  del propio usuario. WhatsApp histórico físico no tiene ownership acreditado:
  se devuelve vacío explícitamente en esta vía, sin retirar la API runtime.
- Estado de transporte IPC expone sólo booleanos operativos; no chats/números
  globales o errores del proveedor. Otros handlers directos siguen pendientes.

## Risks / Trade-offs

Cambios de organización invalidan resultado aunque el usuario vuelva a la anterior.
Una respuesta de envío perdida no autoriza reintento automático. Confirmación no
concede permisos: SOFIA sigue decidiendo rol/capacidades. Pendiente broker de
ownership para transportes compartidos y revisión independiente antes de archivar.

## Migration Plan

Desplegar las cuatro capas juntas. No nuevos canales, dependencias o migraciones.
Revertir sólo delta respaldado contra lote 47; preservar índice y trabajo ajenos.
