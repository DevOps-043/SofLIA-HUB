## Context

Ver proposal/context-pack. Dos capturas asíncronas y sus cachés viven en el
coordinador. Los destinos en curso sólo guardan tabId/URL y el cierre asigna
null a promesas que pueden seguir resolviéndose. Las verificaciones de documento
sensible y autorización existen y deben seguir rodeando cada operación.

## Goals / Non-Goals

**Goals:** propietario cohesivo del estado efímero/timer y trabajos de percepción,
invalidación irreversible por ciclo, destino/documento preciso y publicación
condicionada a vigencia. Conservar fachada y comportamiento de permisos.

**Non-Goals:** cancelar físicamente capturePage (API sin esa capacidad), añadir
polling, capturas paralelas adicionales, persistencia o canales nuevos.

## Decisions

- Módulo interno de percepción con estado/caché, trabajos en curso y timer.
El servicio conserva descubrimiento de pestaña, guardas de sitio/documento y
captura/DOM; integra el módulo mediante contratos tipados. Evitar extraer la
clase entera o introducir buses/fachadas transitorias sin consumidor.
- Un ciclo monotónico cambia al pausar/reactivar o reiniciar sesión. Destino
incluye identidad de contents/documento/carga/perfil y revisiones visual, de
política y de control; URL igual
no acredita un documento idéntico. Comprobar también vigencia tras esperas de
política/sensibilidad, antes de empezar trabajo nativo y antes de publicar.
El cambio de política retira percepción antes de esperar su guardado, igual que
la autorización explícita existente. La revisión de política también forma
parte de la identidad de trabajos pasivos, sin añadir permisos.
- Mantener un trabajo físico por tipo. Sólo el mismo destino/ciclo vigente puede
compartir resultado. Otro ciclo espera a que el anterior termine y pide una
captura nueva; nunca reutiliza su resultado. Invalidar no abandona el slot físico
ni concede al finally anterior propiedad sobre un trabajo posterior.
- Caché/error/secuencia sólo se publican bajo propiedad vigente. Un fallo
revocado no puede reemplazar el estado de la nueva sesión. Invalidación por tab
retira sus cachés y resultados; cierre invalida todo y cancela timer.
- Timer conserva cadencias/configuración y ejecución por eventos sin polling.
La captura explícita/su permiso siguen autorizándose por el servicio existente;
el módulo no concede permisos ni registra contenido, URL o errores nuevos.

## Risks / Trade-offs

Una captura nativa sin resolver puede retrasar la siguiente del mismo tipo →
conservar serialización y documentar la falta de cancelación física; no abrir
trabajos ilimitados al alternar pausa. Un puerto demasiado genérico puede
desdibujar ownership → API pequeña, tipos concretos y pruebas consumidoras.
Mocks no acreditan Electron → repetir percepción/navegación nativa con fixtures.

## Migration Plan

Regresiones rojas primero; implementar estado e integración, probar errores y
ABA, preservar contratos públicos, ejecutar smoke y gate/build congelados.
No existe migración persistente. Reversión selectiva requiere conservar las
regresiones de privacidad; no restaurar publicación revocada ni deshacer otras
unidades. Revisión independiente pendiente antes de archivar.
