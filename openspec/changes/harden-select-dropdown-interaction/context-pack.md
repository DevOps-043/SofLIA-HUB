# Contexto del cambio

- Objetivo: reducir deuda de accesibilidad del selector compartido, manteniendo integración y API.
- Usuario o actor: usuario de teclado, lector de pantalla y controles con opciones dinámicas (dispositivos/configuración).
- Alcance: navegación por identidad, opciones válidas, búsqueda por prefijo, cierre/foco, nombre del listbox y movimiento reducido local.
- No objetivos: certificar WCAG global, sustituir diseño, agregar dependencias, alterar selección al recorrer o al salir con Tab, resolver backend IRIS.
- Restricciones: conservar diez unidades validadas; no perfiles reales/secretos; IRIS sólo metadatos documentados, sin mutaciones remotas.
- Contratos afectados: SelectDropdownOption/props/onChange conservados. Confirmar una opción habilitada sigue siendo la única escritura de valor.
- Riesgo y HITL: cambiar un selector puede afectar varios formularios; probar consumidores y DOM/Chromium temporal. No requiere efectos externos para verificar.
- Criterios: aria-activedescendant siempre existente/habilitado o ausente; reordenar no cambia identidad activa; opciones vacías/deshabilitadas no se confirman; Escape primero cierra popup; blur/Tab cierran; deshabilitar no reabre al habilitar; prefijo y caracteres repetidos, sin interferir con atajos/composición; etiquetado externo conservado; portal modal y foco preservados; 200% y AX en Chromium local.
- Incertidumbres: no hay objetivo WCAG formal ni auditoría AT; no declararlas satisfechas por este control. APG select-only/listbox consultadas como guía de interacción.
