# Diseño

La entrada principal detecta `view=orb` antes de importar App y carga un root mínimo con el mismo AuthProvider y useTheme. La autenticación se conserva; los gestores del shell principal y el updater visual permanecen en la ventana principal. El avatar conserva voz, herramientas, fuentes y reuniones. Los avisos de IPC comunes se registran también en esta entrada.

Un controlador de refresco por recurso escucha foco/visibilidad, conserva invalidaciones mientras está oculto, agrupa eventos con 50 ms y programa el próximo poll después de finalizar la solicitud anterior. No se solapan consultas del mismo controlador. Dispose retira timers/listeners y los consumidores descartan respuestas tardías. Realtime continúa suscrito y marca datos pendientes; se recupera la vista al hacerla visible. No se interrumpe trabajo del agente ni persistencia local.

Superficies secundarias usan lazy/Suspense con mensajes en español. Markdown se memoiza por texto: mensajes históricos no vuelven a parsearse sólo porque otro mensaje recibe tokens. No se limita el historial ni se cambia su contenido.

El avatar conserva expresiones, seguimiento y voz, pero acota escrituras DOM a aproximadamente 30 fps si navigator informa memoria de hasta 4 GB o hasta dos procesadores lógicos. Las duraciones usan delta temporal; audio/transcripción no se reducen. Se mantiene la pausa por invisibilidad y movimiento reducido.

Revertir el diff de este cambio restaura la programación y composición anterior. Sin migraciones ni efectos externos. La mejora observada en fixtures/build no acredita automáticamente el rendimiento en todos los Pentium.
