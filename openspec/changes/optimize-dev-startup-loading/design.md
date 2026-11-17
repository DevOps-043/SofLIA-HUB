# Diseño

## Carga

Promise.all solicita los imports independientes al comenzar la carga de servicios. Conserva el orden del array al desestructurar y el mismo objeto de retorno. Los módulos compartidos se evalúan una vez por el runtime; no se construyen servicios ni se registran handlers hasta resolver el conjunto. agent-task-queue permanece al final como antes. Un fallo rechaza el bootstrap; no se publica un conjunto parcial.

configureMainProcessEnvironment se ejecuta antes de solicitar los módulos, para que consultar process.env al evaluar un módulo no dependa de que otro import haya leído .env antes por casualidad. Se conservan las rutas/fallback y las reglas de dotenv existentes. La inicialización y restauración de sesiones mantienen su secuencia.

## Desarrollo y diagnóstico

El build main/preload omite reportCompressedSize sólo cuando el comando raíz es serve. El build de producción mantiene sus opciones. No se modifican las fronteras de secretos ni se silencia dotenv para ocultar la pausa.

El watcher reproduce un segundo build sin invalidación declarada y con el mismo SHA-256 de todas las salidas. No se atribuye a una causa interna no probada ni se anula la vigilancia. Un plugin calcula una huella de nombres, tipos y contenido de todos los chunks/assets emitidos: un build idéntico comparte/no repite el arranque. Cambios reales solicitan reinicio; la cola evita solapamientos y permite reintentar tras fallo. El callback preload usa el mismo coordinador y después conserva reload del renderer. Sólo se instala en serve.

El reloj BOOT parte del origen del proceso, en lugar del momento tardío de evaluación de boot-timeline. main:entrada mide cuándo terminó el grafo estático; fases separadas miden carga, entorno y constructores. Los logs contienen etiquetas fijas y milisegundos, sin valores de entorno.

## Compatibilidad y reversión

En modo `serve`, main resuelve Baileys de la instalación local. La conexión y el descargador del hub heredado usan `import()` asíncrono. La conexión entrega a sus callbacks el código de cierre y el descargador de la versión cargada, y revalida el intento después de esperar el import. La compilación de producción sigue empaquetando el SDK. Esta decisión preserva la recarga de las fuentes locales.

Se preservan constructores, todos los handlers, sesiones, ventanas y secuencia de init. Revertir únicamente este diff recupera la carga secuencial y el informe gzip dev. Las métricas y smokes aislados no acreditan un arranque con cuentas reales ni un tiempo garantizado en otra máquina.
