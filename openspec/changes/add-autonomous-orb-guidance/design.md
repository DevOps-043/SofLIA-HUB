## Context

El orbe ya vive en BrowserWindow; ResolvedActionTarget y ScreenshotLayout describen elementos y geometría. El evento step de Gemini pierde las coordenadas y no es una barrera previa a ejecución. El estudio académico no transmite medios.

## Decisions

- Un coordinador main gobierna superficies y estado; el renderer únicamente muestra estado y solicita controles tipados.
- El acompañamiento de escritorio se inserta después de resolver coordenadas y antes del efecto nativo. Las acciones por texto presentan la caja antes del clic físico.
- El navegador integrado usa el origen real de su WebContentsView, conserva guardas de documento y revalida después de esperar.
- La capa de marcas no tiene preload, acceso a Node ni navegación externa. Las capturas de escritorio ocultan temporalmente las superficies propias con exclusión y restauración condicionada al estado vigente.
- Pausar no concede control adicional. Detener cancela Computer Use y la práctica. Las órdenes y restauraciones tardías se invalidan por revisión.
- Las prácticas usan texto visible y una condición de éxito separada, comprobada por UIA/OCR; el instructor prepara recetas locales, sin publicación ni control remoto.

## Risks / Trade-offs

Ocultar ventanas al capturar puede producir parpadeo en grabaciones; debe verificarse en hardware real. Elementos sin semántica usan señal puntual, nunca una caja inventada. La guía se retira si el contexto cambia; la animación local no implica llamadas al modelo por fotograma.
