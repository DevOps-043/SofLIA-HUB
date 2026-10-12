# Contexto del cambio

- Objetivo: que una orden simple de abrir Firefox produzca una llamada real y
  una respuesta coherente con la evidencia disponible en Linux.
- Usuario o actor: usuario local autenticado del chat de SofLIA.
- Alcance: resolución, lanzamiento y comprobación de aplicaciones Linux;
  ruta determinista del chat para una apertura explícita de Computer Use.
- No objetivos: control visual Wayland, proveedores de accesibilidad Linux,
  nuevos IPC, permisos, modelos conversacionales o empaquetado de release.
- Restricciones: español, sin shell general, secretos ni cambios ajenos.
- Contratos afectados: `open_application` / `computer:open-application`,
  campo aditivo `window_verified`, historial y texto de la respuesta del chat.
  Preload y wrapper existentes se conservan.
- Riesgo y HITL: apertura local reversible solicitada, misma autenticación y
  dispatcher. WhatsApp y operaciones externas conservan confirmación.
- Criterios verificables: resolución por nombre instalado; fallo sin éxito
  inventado; lanzamiento real; verificación X11 por proceso y primer plano;
  límite Wayland explícito; una sola llamada; cancelación/timeout; catálogo y
  alcance de extractos respetados; órdenes compuestas fuera del atajo.
- Incertidumbres: la captura no contiene traza del turno original; no se
  observó la ventana Wayland ni se probó hardware Windows/X11/macOS.
