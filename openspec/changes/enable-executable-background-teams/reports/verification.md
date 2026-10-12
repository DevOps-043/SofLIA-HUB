# Verificación de equipos ejecutores locales

Fecha: 2026-10-11. Estado: fase local implementada; ampliaciones pendientes.

## Implementado

Electron main mantiene la cola de trabajos con dos especialistas y un
coordinador, persistencia cifrada, identidad host, organización, presupuesto,
timeout, pausa/reanudación/cancelación y recuperación sin repetir resultados
confirmados. Las herramientas ejecutan lectura, investigación autorizada y
creación real de Markdown/texto/CSV/Word, Excel y PowerPoint. No exponen shell.
El coordinador lee los archivos del equipo; la comprobación host valida
integridad y formatos. Chat y monitor flotante muestran operaciones y todos
los entregables. Los archivos se abren con el [visor integrado](../../preview-generated-artifacts/reports/verification.md).

## Evidencia

El piloto ejecutado en el chat produjo siete Markdown con dos especialistas y
un coordinador: 107376 ms, 16 llamadas, 27 herramientas y 75744 tokens observados.
Se comprobó posteriormente el vínculo del mensaje en el host y la apertura de
sus archivos desde el chat. El resumen antiguo contenía limitaciones de lectura
incorrectas; las instrucciones y la resolución de IDs se corrigieron y el
coordinador ahora abre los archivos reales. Esta evidencia no se presenta como
una repetición del piloto completo con cada corrección posterior.

La compuerta actual `npm run verify:pr` pasó: 377 archivos y 3996 pruebas aprobados,
con 1 archivo/prueba omitido. Pasó también `npm run build:app`. Las regresiones
cubren recuperación, generación, presupuestos, cancelación tardía, vinculación
al chat, integridad, lectores e IPC. La revisión independiente identificó fallos
que se corrigieron con regresiones; el detalle del último incremento está en
el informe del visor.

La tarea 1.10 conserva pendiente una nueva ejecución autenticada de extremo a
extremo tras las correcciones finales; el reinicio dejó la app en login y se
solicitó al usuario iniciar sesión. No se archiva el cambio ni se atribuye esa
prueba pendiente a las comprobaciones locales.

## Fuera del incremento local

Las fases 2 y 3 siguen pendientes: coordinación más amplia, operaciones externas,
exclusión de pantalla, programación por petición expresa y host remoto. La
investigación original sigue en [fuentes oficiales](research.md); la propuesta
y el diseño distinguen estas ampliaciones del comportamiento implementado.
