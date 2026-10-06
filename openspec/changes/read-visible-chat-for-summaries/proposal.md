## Why

Con ChatGPT abierto en el navegador integrado y el chat de SofLIA visible, «Realiza
un resumen del siguiente Chat…» obtuvo «No veo el contenido del chat». El usuario
tuvo que seleccionar todo el texto y adjuntar la pestaña manualmente.

Diagnóstico confirmado en el código:

1. El clasificador sólo reconocía «este chat» o «chat abierto/visible»; «el
   siguiente chat» no adjuntaba ninguna evidencia del navegador.
2. Aun clasificada, la observación sólo recorre el viewport (±240 px, máximo
   1 800 nodos de texto): un chat largo quedaba recortado.
3. La extracción documental completa sólo tomaba `p`, `li`, `h*`, `pre` y
   `blockquote`; los mensajes del usuario en ChatGPT viven en `div` y se perdían.

## What Changes

- Reconocer «el siguiente / presente chat, conversación, página…» como
  referencia a la pestaña, salvo que el mensaje ya traiga contenido extenso.
- Para resumir, analizar u opinar sobre la página o conversación visible, leer
  la pestaña completa con la ruta documental existente y, si falla, observar lo
  visible.
- Conservar en la extracción los turnos marcados con `data-message-author-role`
  que no contienen bloques semánticos.

## Capabilities

### New Capabilities
- `visible-page-summaries`: resúmenes de la conversación o página visible con su contenido completo.

### Modified Capabilities
Ninguna. Reutiliza `integrated-browser:document-read` sin cambiar su contrato.

## Impact

Clasificador y enrutamiento del chat (Gemini y OpenAI comparten la ruta) y
extractor del modo lectura en main. Sin nuevos canales IPC, permisos,
dependencias ni migraciones. El modo lectura en voz también incorpora esos
turnos.

No objetivos: leer chats que virtualizan mensajes fuera de pantalla, ampliar el
límite de 60 000 caracteres o añadir reglas específicas de otros sitios.
