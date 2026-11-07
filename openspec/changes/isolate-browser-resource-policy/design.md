## Context

Ver propuesta. El servicio mantiene vistas, layout y perfiles; sus algoritmos LRU/inactividad y timer son una responsabilidad independiente. La vía LRU puede cerrar trabajo que la vía de inactividad protege.

## Goals / Non-Goals

**Goals:** una política coherente de presupuesto/inactividad con timer invalidable; puertos pequeños a las vistas; proteger trabajo y conservar identidad/snapshot.

**Non-Goals:** nuevo framework de layout, modificar IPC/persistencia, mover objetos nativos al renderer o prometer ahorro medido.

## Decisions

- BrowserResourcePolicy es genérico sobre identidad/lastActivatedAt, sin importar Electron. Sus puertos enumeran vistas vivas, consultan disposición/presentación/trabajo, aplican throttling y retiran una vista. El servicio conserva consultas nativas, snapshot, destroy y estado loading por pestaña.
- La política posee timer, generación y deadline. enforceBudget/reconcile no acumulan timers y stop invalida callbacks ya encolados. Un timer reevalúa desde el estado actual; no conserva objetos de otro perfil como payload del callback. Conserva unref y las constantes existentes.
- Presupuesto LRU excluye disposición protegida y trabajo nativo activo (carga, espera de respuesta, audio, captura, DevTools). El objetivo es ocho vistas: si todas las candidatas están protegidas puede excederse temporalmente, con retry de 30 segundos. No sacrificar audio/captura para simular un límite duro.
- Reconcile también aplica presupuesto, luego presentación/throttling y gracia a las vistas restantes. Una reciente oculta sigue warm; ventanas ocultas usan su gracia existente. Si cesa trabajo, el retry recupera el objetivo con candidatas actuales. El timer conserva el vencimiento más próximo al recibir otras solicitudes de reprogramación.
- Errores del callback periódico se reportan saneados y con retry, sin prometer que una API nativa que falló produjo efectos. Los callers síncronos conservan propagación de errores. La retirada captura snapshot antes de destruir y sólo notifica estado cuando hay cambio.
- Una revisión de retiradas permite publicar progreso parcial si falla después el throttling. El callback publica sin volver a reconciliar en emitState: evita repetir la API que acaba de fallar. Errores del notificador también quedan controlados; no hay garantía de entrega de eventos si el propio consumidor falla.

## Risks / Trade-offs

- Exceso temporal de vistas → protección gana al objetivo; retry acotado y límite lógico existente de 500 pestañas. No hay benchmark/SLO nuevo.
- Puertos al coordinador → compartir sólo decisiones/datos de política, no exponer service ni permisos. Pruebas de API pública y lifecycle preservados.
- Timer viejo tras perfil/cierre → generación y stop comprobados con callbacks retenidos; smoke de ventanas/vistas reales temporales.
- Native beforeunload/trabajo no detectable → mantener guardas actuales y no prometer protección de formularios arbitrarios ni nuevo cierre interactivo.

## Migration Plan

Sin migración. Registrar baseline; reproducir presión sobre audio/captura con servicio; probar política independiente y regresiones, smoke Electron con recursos locales temporales, tipos/lint/build/gate. Revertir módulo e integración juntos conserva las nueve unidades anteriores y formato/API. Revisión independiente pendiente antes de archivar.
