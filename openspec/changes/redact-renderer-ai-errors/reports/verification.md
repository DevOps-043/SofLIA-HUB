# Evidencia de privacidad de errores de IA

Fecha: 2026-11-03. Cambio local, sin despliegue.

Las pruebas iniciales reprodujeron tres filtraciones de valores ficticios en
consola de imagen y Flow. La revisión propia posterior encontró otra exposición
al fallar un intento Gemini; una prueba independiente del resultado de esa
revisión la reprodujo antes de corregirla. El dictado fue probado con audio y
proveedor simulados; no muestra ni registra el detalle ficticio.

La ejecución final `npm run verify:pr` terminó con código 0: 6967 pruebas
aprobadas, cinco omitidas; cobertura de 2615 fuentes productivas: líneas 60.10%,
sentencias 58.65%, funciones 55.12% y ramas 52.12%. `npm run app:smoke:build`
también terminó con código 0, sin acreditar instalador, inicio ni cuentas reales.
Los logs están en `%TEMP%/soflia-private-errors-2026-11-03/gate-reviewed.log` y
`build-reviewed.log`; las pruebas dirigidas y casos iniciales están en el mismo
conjunto de respaldos.

La revisión propia abarcó fallos de proveedor, mensajes visibles, reintentos y
registros de documento/navegador. No sustituye una revisión independiente: ésta
sigue pendiente. El cambio no protege todos los logs ni mueve claves Gemini fuera
del renderer; esas brechas permanecen abiertas. No se recalculó el índice global
de deuda. La integración con otras ramas y la validación de proveedores reales
no forman parte de esta evidencia.

## Acciones posteriores a investigación

Una prueba reprodujo la exposición del error en dos registros usando datos
ficticios. Se sustituyó por la clasificación pública y se verificó que fallo y
cancelación conservan el resultado de investigación. Pasaron 26 pruebas dirigidas.
La compuerta posterior aprobó con 6969 pruebas y cinco omitidas; cobertura de
2615 fuentes: líneas 60.14%, sentencias 58.68%, funciones 55.13% y ramas 52.14%.
El build aislado aprobó. Logs en `%TEMP%/soflia-private-errors-2026-11-03/`:
`research-red.json`, `research-directed.json`, `gate-research.log` y
`build-research.log`. Permanece pendiente la revisión independiente.
