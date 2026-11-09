# Contexto

- Objetivo: reducir acoplamiento del coordinador del navegador y unificar protección de trabajo al gestionar vistas nativas.
- Evidencia: service.ts mantiene dos algoritmos de suspensión, timer y generación. La política fría protege carga/audio/captura/DevTools; el presupuesto de ocho vistas no consulta esa protección y puede destruir una vista audible oculta.
- Alcance: módulo propio de decisión/presupuesto/temporizador, puertos síncronos a los datos/vistas del servicio; proteger trabajo tanto por inactividad como por presión y reintentar cuando cesa.
- Contratos: mismos métodos públicos, canales, perfiles y formato de sesión; la identidad lógica y snapshot se conservan al suspender. Ocho es objetivo de vistas; si todas las candidatas están protegidas se conserva trabajo y se reevalúa sin forzar cierre.
- No objetivos: reescribir navegador, cambiar observación/credenciales/permisos ni prometer reducción medida de RAM/CPU. Sin cargar páginas/perfiles de usuarios ni red.
- Criterios: ventana/división/overlay/agente conservados; audio/carga/captura/DevTools no se suspenden por presión; LRU de elegibles, gracia/warm/throttling intactos; stop invalida callbacks antiguos y reintento recupera presupuesto al cesar protección; API pública preservada, regresión servicio y smoke Electron temporal.
- Restricciones: conservar nueve unidades anteriores, módulos main/preload/renderer, sin datos reales, secretos, dependencias ni canales nuevos.
- Riesgos: límite temporalmente excedido si todo está protegido; no hay benchmark. Callbacks no deben actuar tras cambio de perfil/cierre; el servicio sigue siendo dueño de materializar/destruir vistas y capturar snapshot.
