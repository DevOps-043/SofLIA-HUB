# Reducir trabajo y esperas del arranque de desarrollo

## Why

El usuario mide unos 60 segundos desde npm run dev hasta el login, con una pausa percibida alrededor de los mensajes de dotenv. El log aportado muestra builds main consecutivos (15381/1954 ms), preload de 5554 ms y app:ready a 13625 ms del reloj anterior. La carga secuencial de módulos es una causa comprobable de esperas; la asociación temporal con dotenv no acredita que leer .env sea la causa.

## What Changes

- Solicitar en paralelo los módulos de servicios, conservando todos sus exports y el registro de IPC antes de crear ventanas.
- Evitar el cálculo de tamaños comprimidos en los bundles de desarrollo; conservarlo en producción.
- Evitar reiniciar Electron por un rebuild que emite exactamente el mismo contenido; serializar arranques y mantener recarga de preload.
- Medir entrada main, carga de módulos, entorno y construcción de servicios con tiempos relativos al proceso.
- Conservar el watcher, incluso si vuelve a compilar sin cambios; no desactivar HMR ni ignorar fuentes.
- Reducir el grafo de main en desarrollo mediante el import asíncrono del SDK de WhatsApp ya instalado. El log siguiente confirmó 2 ms en entorno y 31 348 ms en el primer build main mientras Vite reoptimizaba las dependencias del renderer.

## Capabilities

### New Capabilities
- `startup-loading`: carga completa concurrente y diagnóstico por fases del arranque.

### Modified Capabilities

Ninguna API pública, canal o función de usuario cambia.

## Impact

Bootstrap main, configuración Vite y documentación operativa. No cambia credenciales, sesiones, permisos, funcionalidades ni el orden de inicialización de los servicios.
