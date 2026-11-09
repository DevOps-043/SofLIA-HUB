## Context

Ver proposal/context-pack. El backend actual arma shell con texto y mantiene
OCR sin lease interna. La API Tesseract 7 instalada devuelve blocks opcionales.

## Goals / Non-Goals

Separar datos de programas fijos y mantener primitivas, fuente y sesión durante
esperas. No reemplazar el driver completo de Desktop Agent, confirmar entrada
física real ni conceder permisos adicionales a rutas runtime.

## Decisions

- Transportar datos mediante spawn sin shell, STDIN/argv y scripts fijos por SO.
  No usar escape manual de shell ni clipboard temporal. Windows recibe JSON
  codificado por stdin, evitando límite de línea de comando y expansión de datos.
- Parser cerrado de tecla/combinación y escritura literal distinta de key;
  traducir sólo tokens conocidos. No aceptar fragmentos arbitrarios SendKeys.
- Ejecutor con timeout/salida acotados; abortar proceso y esperar cierre físico.
  No liberar plaza por rechazo lógico mientras un hijo sigue vivo. Errores fijos.
- Propagar contexto main a GUI; además capturar revisión de autenticación para
  entradas runtime. Comprobar después de captura/OCR y antes de proceso/captura
  final. Revocación no dispara screenshot adicional de depuración.
- Pedir blocks en Tesseract 7, extraer líneas/palabras con estructura comprobada
  y terminar worker en finally. Evitar crear fallback de idioma tras revocación.
- Conservar fachada performGuiAction y rutas de servicio. Backends del driver
  Desktop Agent no se reutilizan porque incluyen fallback con otros contratos,
  coordenadas/configuración propias y llamadas no cancelables.

## Risks / Trade-offs

- Pruebas simuladas no acreditan permisos/entrada SO → documentar validación
  nativa pendiente, sin usar GUI para sortear restricciones del entorno.
- Evento ya enviado puede producir efecto → no prometer rollback ni exactly-once.
- Proceso que ignora kill/cierre conserva plaza → no cola ni reintento automático.
- OCR depende de modelos instalados/descargados por Tesseract → no acreditar
  disponibilidad offline ni ausencia de descarga del motor existente.
- Cancelar proceso durante gesto puede dejar estado físico parcial; los scripts
  intentan liberar botones en finally, sin garantizar limpieza tras kill del SO.

## Migration Plan

Sin canales, dependencias o formatos persistentes nuevos. Integración main
conserva preload/wrapper de unidad 42 y aprobación nativa. Revertir sólo delta
respaldado en TEMP frente a unidad 42, sin tocar índice ajeno. Suite dirigida,
compuerta global/cobertura y build aislado. Revisión independiente pendiente.
