# Colores y copia fiable en los bloques del chat

Los comandos de SoflIA se muestran como texto monocromo. El botón de copia llama
al portapapeles web sin esperar su resultado, aunque la ventana de Electron solo
concede permisos de medios y puede rechazar la escritura.

Se reutilizan highlight.js y la paleta existente para resaltar los lenguajes
habituales, incluidos BAT/CMD y PowerShell. La copia usa primero el puente nativo
existente; en navegador conserva las alternativas web. La confirmación se muestra
solo tras una copia exitosa y los fallos permiten reintentar.

El texto copiado conserva exactamente el contenido original. No cambia IPC,
autenticación, permisos, dependencias ni ejecución de comandos.
