## Context

Ver [propuesta](proposal.md) y [contexto](context-pack.md). Window repite contratos con 78 any; preload devuelve promesas sin vínculo a firmas públicas. Tipos de config/estado Desktop y registros remotos ya existen, pero están duplicados o situados en módulos main con efectos. No se leerá configuración de usuarios para inferir DTO.

## Goals / Non-Goals

Una fuente canónica pura por dominio, productores y consumidores comprobados por TypeScript, datos dinámicos honestamente unknown. No rediseñar autorización/HITL o afirmar que tipos conceden seguridad en runtime.

## Decisions

- Extraer definiciones de datos existentes a src/shared y reexportarlas desde sus rutas main compatibles; no copiar dos versiones ni importar implementación main en renderer.
- Contratos Computer Use con resultados de herramientas como objetos de campos unknown cuando su esquema es dinámico; status/config/tareas/perfiles Desktop y registros/config Remote precisos según productores. APIs preload satisfacen las interfaces compartidas y Window sólo referencia esas interfaces.
- El cliente remoto parsea JSON como unknown, comprueba objeto antes de acceso, valida listas de strings y normaliza errores no textuales. Mantener el sobre raw legacy para texto no JSON; no añadir reintentos, destinos, cuotas o políticas de autoridad ficticias en este lote.
- Pruebas de compatibilidad de rutas y tipos negativos compilables, más transporte/metadata con respuestas ficticias. Una sola compuerta final con cobertura y build; medir lint global/directo al finalizar.

## Risks / Trade-offs

- El tipado reveló tokens en resultados conversacionales. Una proyección pura
  compartida retira sólo el campo token conocido y añade token_configured en
  ambos recorridos runtime. La API manual conserva emparejamiento. No equivale
  a cifrado/ownership ni a sanear secretos reflejados en respuestas arbitrarias.

- Tipo demasiado preciso para una salida dinámica → usar unknown explícito y validar antes de asumir propiedades, sin inventar esquema.
- Movimiento de tipos altera imports → reexports compatibles y pruebas de consumidores/typecheck.
- Hallazgos de autorización/HITL preexistentes → registrarlos expresamente; este refactor no los declara resueltos ni expone permisos nuevos.

## Migration Plan

Respaldar sólo fuentes tocadas en TEMP con rutas relativas. Integrar contratos y consumidores juntos sin renombrar canales. Pruebas focalizadas, tipos/lint y gate con cobertura/build sobre hashes estables. Revertir sólo el delta de esta unidad. Sin datos, secretos/.env, dependencias, UI real, stage/commit/push o despliegue; no archivar sin revisión independiente.
