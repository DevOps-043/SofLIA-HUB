# Verificación del lote 38

Fecha local: 2026-10-26. Implementación integrada y verificación local aprobada.

Se centralizaron los contratos Computer Use, Desktop Agent y Remote Node en
DTO puros compartidos; se conservaron canales, argumentos y reexports main.
Opciones IPC excluyen AbortSignal; main conserva cancelación interna. Se retiró
any de las tres interfaces públicas y se comprobaron consumidores sin casts any
nuevos. Las respuestas extensibles siguen siendo unknown hasta validarlas.

El cliente remoto rechaza JSON no objeto, comprueba capacidades sin perder
valores futuros válidos y normaliza errores. La proyección compartida retira
el campo token de host y registros para ambos recorridos conversacionales,
sin mutar originales ni cambiar la API manual de emparejamiento.

## Evidencia

- Frontera remota antes de la corrección: 9 fallos y 3 aprobadas; después,
  12 aprobadas. El primer intento del wrapper corrió tras cambiar el código:
  fue verde y no se presenta como prueba roja causal.
- Suite dirigida final: 147 aprobadas, cero fallos en ocho archivos.
- Typecheck y lint incremental aprobados. El lint global conserva deuda previa;
  la medición pasó de 2009 a 1888 errores, con 31 avisos. Los mensajes any en
  producción bajaron de 1416 a 1295 (121 eliminados).
- Los argumentos negativos de compilación cubren tipos incorrectos, señal en
  IPC y uso de campos unknown sin estrechar. No se invoca su función de ejemplo.

La compuerta completa pasó sus 14 etapas: 6087 pruebas Vitest aprobadas y 5
omitidas, 62 del tooling y 33 Python. No se ampliaron omisiones ni dependencias.
La cobertura de las 2567 fuentes productivas subió: líneas 56.92 → 57.04%,
sentencias 55.61 → 55.71%, funciones 51.70 → 51.82% y ramas 49.60 → 49.69%.
Los pisos y exclusiones se conservaron. Build aislado aprobó los seis artefactos.

Las 3542 fuentes del manifiesto conservaron hashes idénticos durante compuerta
y build. El delta es de 26 fuentes existentes y 9 nuevas; respaldos de las
existentes coinciden con el estado validado de la unidad 37. No aumentó ninguna
cuenta por archivo/regla/severidad frente a esa base. Tras corregir un fixture
de portapapeles se repitió su lint: cero incidencias, igual que el informe global.

Recibos: [compuerta](gate-summary.json), [build](build-summary.json),
[cobertura](coverage-evidence.json), [lint](lint-evidence.json),
[regresiones](regression-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json). Logs originales y respaldos relativos bajo el
directorio temporal soflia-automation-contracts-2026-10-25.

La reducción comprobada es de 121 errores globales (2009 → 1888; 6.02%) y
121 mensajes any de producción (1416 → 1295; 8.55%). No se trasladó any a otro
archivo ni se añadieron casts any/supresiones productivas. El último índice
global publicado sigue siendo 40.88% después de la unidad 37: este lote mejora
brechas dentro de los mismos criterios, sin justificar por sí solo otro escalón
de 25 puntos en la rúbrica ordinal. No se presenta la mejora de lint como puntos
de deuda global.

## Revisión propia y límites

Se revisaron rutas de respuesta válida, JSON null/primitivo/array, metadata
malformada/extensible, transporte rechazado, errores no textuales, compatibilidad
de consumidores y exclusión no mutante del campo token en ambos recorridos.
Las pruebas sustituyen red/servicios; no ejecutan acciones nativas ni GUI.
La revisión propia no sustituye revisión independiente, que queda pendiente;
no se archiva el cambio.

La proyección retira el campo conocido, sin garantizar saneamiento de secretos
reflejados en textos/payloads arbitrarios. Siguen pendientes custodia cifrada y
ownership de nodos, autorización uniforme por fuente y HITL obligatorio en main.
Algunas rutas confían sólo en sesión global o confirmación renderer. Este lote
no declara cerradas esas brechas ni acredita producción/CI remotos.

## Reversión

Restaurar únicamente fuentes de esta unidad desde sus respaldos relativos y
retirar sus archivos nuevos; conservar todo el trabajo previo. No hay migración,
dependencias nuevas, escritura remota, stage/commit/push ni despliegue.
