# Evidencia de rendimiento: tres pestañas

Estado: ejecutado el 2026-08-13 en Windows, Electron fijado por el repositorio.

## Escenario

Comando: `npm run benchmark:resources`.

El harness abre tres páginas dinámicas locales equivalentes en dos procesos
Electron aislados. La línea base reproduce `backgroundThrottling: false` en las
tres vistas. La variante optimizada permite throttling en las dos ocultas y
libera una vista fría. Para mantener la corrida por debajo de un minuto, sólo en
el benchmark la gracia de suspensión se acelera de 90 s a 10 s. Se descartó el
warm-up y se promediaron las cinco últimas muestras, cada 2 s.

## Resultado observado

| Métrica | Línea base | Optimizada | Reducción |
|---|---:|---:|---:|
| CPU agregada | 16,58 % | 4,86 % | 70,69 % |
| working set agregado | 779,32 MB | 639,69 MB | 17,92 % |
| procesos Electron | 6 | 5 | 16,67 % |
| procesos de pestaña | 3 | 2 | 33,33 % |

Las cinco muestras optimizadas mantuvieron CPU entre 4,49 % y 5,17 % y RAM
entre 639,66 y 639,72 MB. Las cinco de línea base mantuvieron CPU entre 16,22 %
y 17,43 % y RAM entre 779,26 y 779,41 MB.

## Interpretación y límites

Este resultado confirma el impacto del mecanismo en Chromium, no promete la
misma reducción para cualquier sitio o equipo. El fixture es sintético, local y
no incluye todos los servicios de Pulse Hub. La cifra real depende de pestañas,
extensiones, caché, GPU y carga concurrente. La línea base de usuario de
1,5–1,9 GB y 15 % de CPU se conserva como observación reportada, no como muestra
producida por este harness.

Fuentes: `scripts/performance/electron-resource-benchmark.cjs`,
`scripts/performance/run-resource-benchmark.mjs`,
`electron/integrated-browser/service.ts` y `electron/resource-diagnostics.ts`.
