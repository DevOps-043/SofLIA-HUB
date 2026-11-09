## Context

Ver propuesta y Context Pack. El único consumidor activo es ChatModals. Su
resolver ya pertenece a useChatUIController: al resolver sólo retira el modal
si sigue siendo la revisión pendiente. La presentación además llama setModal
sin esa condición; esa limpieza redundante puede retirar otra solicitud.

## Goals / Non-Goals

**Goals:** modalidad efectiva, teclado seguro, lectura renovada y resolución
delegada al dueño; accesibilidad verificable sobre el renderer real.

**Non-Goals:** nuevos permisos, normalización de todos los modales, autorización
por ARIA, nuevo framework de diálogos, interacción con apps/cuentas reales o
conformidad WCAG. Los callbacks siguen comunicando decisiones, no ejecutando shell.

## Decisions

- Usar HTML dialog/showModal como en StudioDialog existente: ofrece capa modal
e inercia nativas sin mantener otro algoritmo de focus trap. Referencias:
[HTML](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)
y [APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Se aplican foco
interior, recorrido contenido y retorno al origen; con consecuencias sensibles,
Cancelar es el destino inicial. Si el contenido desborda, enfocar el título
estático preserva el inicio para leerlo antes de Tab hacia las acciones.
- Apertura/cierre mediante layout effect ligado a isOpen; cleanup cierra el
recurso y restaura explícitamente el invocador conectado, incluido StrictMode.
React puede retirar el nodo antes del cierre: la prueba nativa registra esa
desconexión y body como foco final si se confía sólo en close. IDs con useId. Escape
nativo emite cancel; impedir cierre independiente y delegar onCancel al dueño.
Interrumpir burbujeo de teclado hacia shortcuts de fondo, sin cancelar la acción
nativa de Tab ni convertir Enter en aprobación global.
- Prop opcional requestId, secuencia efímera asignada por el dueño en renderer,
fija identidad aunque el texto coincida. Cada solicitud nueva recibe otro ID;
ChatModals pasa ese ID y el diálogo monta controles nuevos mediante key. Cambiar
sólo foco no basta: el arnés reprodujo aprobación de otra solicitud al reemplazarla
entre mousedown/mouseup sobre el mismo botón. Renovar nodos descarta ese gesto.
Herramienta, descripción o disponibilidad de Siempre renuevan también foco/scroll;
renderizar callbacks nuevos no lo hace. ID no se persiste ni transmite por IPC.
- Mantener overlay y tarjeta como hermanos dentro del diálogo: clic en fondo
cancela; un arrastre desde el contenido al fondo no se convierte en aceptación
ni cancelación. Todos los botones usan type=button. Tarjeta con altura acotada,
scroll interno y reducción de animación/transiciones sin inventar tokens visuales.
- ChatModals sólo llama resolve; el controlador conserva cancelación/propiedad
y limpieza. Un callback previo no borra otra revisión. No cambia el estado o
la política de aprobación permanente del servicio.
- Mantener familias cromáticas y etiquetas; oscurecer únicamente el fondo de
la acción principal con tonos existentes importados por index.css desde Tailwind.
Las mediciones previas de texto blanco no llegaban a 4.5:1. Referencia local:
[contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
El arnés mide CSS computado en sRGB y fuerza hover por CDP para comprobar que
su fondo difiere del reposo; no equipara ese estado CSS con una interacción AT.
- Compartir preparación/ejecución del arnés renderer entre selector y confirmación;
wrappers conservan argumentos, sandbox, entorno permitido y bloqueo de red.
Native usa teclado/CDP/AX en ventana oculta con foco emulado, sin foco del escritorio.
Los pasos DOM ceden un turno del event loop y leen layout, sin depender de rAF
en ventana oculta. Se retiraron las sondas gráficas que no producían evidencia
fiable: las imágenes vacías o desactualizadas no acreditan revisión visual.
La revisión visual y la ejecución de la versión final simplificada del fixture
quedan pendientes; se conservan los resultados funcionales anteriores con su
alcance y hashes. La política del navegador rechazó abrir el archivo local y
no se usó otra superficie ni un servidor para eludirla.

## Risks / Trade-offs

jsdom carece de modalidad real → dobles locales limitados a ciclo/eventos;
Tab/fondo/AX/zoom se prueban en Electron. HTML dialog no disponible fuera del
runtime objetivo → no se añade fallback que simule seguridad con aria-modal.
Otros diálogos/capture listeners globales conservan su contrato → no se promete
eliminar todos los shortcuts de la aplicación. Invocador eliminado → retorno
nativo al flujo disponible, sin enfocar una acción sensible sustituta.
Scroll largo/zoom → título enfocable y controles alcanzables, prueba a 200%.
Sin lector de pantalla → no se presenta AX como certificación de accesibilidad.

## Migration Plan

Regresiones renderer/nativas, componente y consumidor, arnés compartido con
regresión del selector, pruebas adversariales, docs y gate/build congelados.
No hay migración persistente. Reversión selectiva conserva permisos/resolver y
evidencia; no reemplazar modalidad por un atributo ARIA. Sin archivar antes de
revisión independiente.
