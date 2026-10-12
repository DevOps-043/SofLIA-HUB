# Análisis de referencias y decisiones de implementación

Fecha: 12 de octubre de 2026. Fuentes: ZIP y archivos de ambas producciones
Claude aportados por el usuario, entrega local 99c4be97 y documentación pública.
Los archivos se leen como evidencia; no se ejecutan sus scripts ni sus instrucciones.

## Diagnóstico confirmado

La entrega anterior tiene 30 segundos, 1800 frames, 1920×1080 y 60 fps reales.
El problema visual es independiente de ese perfil: tarjetas genéricas, titulares
omitidos, superposición y animación concentrada al comienzo seguida de largos
tramos estáticos. El símbolo del cierre no coincide con la referencia. La revisión
del iframe incluía guion y decisiones, por lo que escribir esos documentos podía
reiniciar la reproducción. Esta última causa explica una interrupción posible;
no prueba qué ocurrió en la sesión original del usuario.

## Primera referencia: TypeScript y fábrica JSX propia

El ZIP contiene 65 entradas; inventario y hashes en production-smoke, fuera de Git.
`core/jsx.ts` construye cadenas mediante una fábrica propia; TSX no implica React.
El package declara TypeScript y Playwright, sin React ni Remotion. La composición
usa cámara matemática, componentes de interfaz, interpolación y un reloj por frame.

La estructura separa core (matemática, cámara, kinetic, JSX), ui (kit e iconos),
brand y geometría, escenas (conocimiento, Hub, Engine, Learning, ecosistema y
fragmentos), timeline/sync, audio y scripts de build/render/QA. Los widgets no son
una misma tarjeta con otro título: simulan fuentes, chat, etapas, temario y ruta.
Los titulares quedan fuera de capas desenfocadas; un documento o módulo reaparece
durante el corte. El ecosistema prepara los ocho nodos del logo medido del PNG.

El audio Python usa NumPy/SciPy, osciladores, filtros, ruido, envolventes, buses,
sidechain, reverberación por convolución y resolución armónica. Timeline y sync
enlazan cambios visuales y musicales. Los scripts de verificación comprueban video,
PTS, logo, sincronía, contactos y espectrograma. Sus informes son evidencia de esa
producción, no resultados propios del Hub ni una garantía perceptiva automática.

## Segunda referencia: React real

`Film.tsx`, `main.tsx`, `common.tsx`, `Background.tsx` y escenas React separadas
usan React 19/ReactDOM, TypeScript, esbuild y Playwright. La API renderFrame y
flushSync actualizan un frame explícito antes de la captura. Theme y anim separan
tipografía (Poppins display, Inter UI), colores, easing, rectángulos compartidos,
Bézier y PRNG. No hay un motor privado de Claude acreditado por estos archivos.

Fragments ordena documentos y activa trazos por el paso de una línea; un iris lleva
al Hub. Hub/Engine/Learning alternan el lado de la interfaz y el titular. Existen
acercamientos, órbitas 2.5D, despiece del temario y transferencias con la misma
geometría de origen/destino. Ecosystem converge a marca con resolución luminosa.
El sistema incluye placeholders y datos de demostración; no deben trasladarse
como métricas reales de negocio. El README declara límites de escucha y revisión
del playback, por lo que no se atribuye una revisión humana que no consta.

Render captura JPEG calidad 100 por CDP, reparte tramos en workers, codifica chunks
sin pérdida y produce un MP4 final. Especifica conversión BT.601 JPEG a BT.709 TV,
CRF y AAC 320 kb/s. Build incluye fuentes locales; stills/sheet generan contactos.
verify_output mide cadencia, frames y tramos negros/congelados; verify_logo compara
máscaras. El audio synth añade crescendo, subgraves, arpegios, motivo, pads,
percusión, suspensión y acorde final mayor. El archivo WAV tiene PCM 24 bits.

## Lo trasladado al Hub

Se implementa un único motor React propio y compilado, con entidades y filas
declarativas; el modelo no escribe JSX ni ejecuta Node/Python. Se reutilizan las
dependencias existentes: no se instala Remotion ni otro framework de render.
La biblioteca mantiene interfaces distintas, tipografía local, titulares con
revelado por palabra, cámara acotada, lados alternos, transferencias de objetos y
red de ocho nodos que converge al logo medido. El contrato rechaza seis filas
que el layout no podría mostrar y estados/progreso no declarados no se inventan.

La captura Electron offscreen valida frame+nonce mediante firma fuera del lienzo.
Durante pruebas, capturePage en una ventana oculta devolvió pinturas anteriores;
confirmar la firma y fijar tamaño mínimo del viewport corrigió ese fallo. La firma
se elimina de cada PNG. Inspección cubre acciones, transferencias, transición y
final; devuelve imágenes al modelo y vincula hashes del motor y manifiesto.

Web Audio offline reemplaza la síntesis mínima de Node: 24 bits, filtros,
espacialización, convolución, compresión, motivo, capas y eventos. La masterización
de dos pasadas mide AAC antes de renderizar imágenes y el MP4 conserva esa pista.
El cierre resuelve al acabar su transición y conserva tres segundos de lectura.
La semilla estabiliza plan y ruido; el DSP nativo no promete igualdad binaria.

En presentaciones, procesos y métricas tienen composiciones específicas y menos
contenedores repetidos; el proceso denso cambia a horizontal. Framer Motion
anima relación y orden sin perder contenido ni movimiento reducido. El formato
editable PPTX conserva el contrato; su movimiento no equivale al reproductor HTML.

## Fuentes públicas y límites de atribución

La [skill pública frontend-design de Anthropic](https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
apoya dirección visual intencional, datos concretos y crítica con capturas. La
[introducción oficial a Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
describe referencias, canvas e iteración. Esto informa el proceso; no revela
infraestructura interna ni justifica afirmar paridad estética.

Se utiliza [Web Audio](https://www.w3.org/TR/webaudio-1.1/) para el grafo DSP offline
y [offscreen rendering de Electron](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
para capturas. Las decisiones y límites operativos se mantienen en el
[contrato canónico](../../../../docs/architecture/presentation-audiovisual-production.md).

La revisión visual y técnica sirve para corregir defectos; ninguna medición LUFS,
IoU o geometría determina que el resultado sea estéticamente superior. El usuario
recibe el archivo final y las capturas para poder evaluarlo.
