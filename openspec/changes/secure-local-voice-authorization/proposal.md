## Why

La voz puede capturar desde ajustes, Orbe o restauración de enabled sin una frontera homogénea de emisor/identidad/consentimiento. Proteger sólo un handler dejaría las otras rutas de entrada, y el broadcast actual expone audio a ventanas ajenas.

## What Changes

- Mantener los canales/métodos renderer existentes y aplicar caller de ventana/rol, marco principal, documento y sesión, aridad y schemas cerrados.
- Compartir contratos y proyectar estado sin rutas del host/errores libres; conservar funcionalidad de ajustes con modelInstalled y reactivación explícita.
- Exigir consentimiento nativo de captura por sesión/configuración, revocable; enabled persistido es preferencia y no autorización. Restaurar mediante revisión nativa tras autenticar, sin captura previa.
- Proteger comandos nativos en servicio y entradas Orbe, detener/invalidar al cambiar sesión y dirigir eventos sólo a los consumidores vigentes.
- Confirmar instalaciones antes de invocar; comunicar incertidumbre de efectos aprobados ya iniciados, sin adjudicar rollback o cancelación de descargas.
- Probar negativas, capas, lifecycle, UI y Electron aislado; actualizar docs/evidencia.

## Capabilities

### New Capabilities
- `local-voice-authorization`: autorización y consentimiento de voz nativa integrado con ajustes/Orbe/sesión.

### Modified Capabilities
Ninguna. No se cambian herramientas ni permisos de agentes runtime, protocolo Python o proveedor de voz.

## Impact

Servicios Python/voz, handlers voice/orb y cableado main; shared/preload/wrappers/UI de ajustes; tipos y pruebas. Sin dependencias, canales nuevos, migraciones, descargas reales, hardware, cuentas ni despliegues. Se preservan dieciséis unidades previas y se mantiene revisión independiente antes de archivar.
