## Context

El selector de pestañas del chat resuelve un problema concreto: el usuario ya tiene el contenido delante y no debería copiarlo a mano. Ese selector se apoya en que el navegador integrado es nuestro, así que el texto de cada pestaña está a una llamada de distancia. Fuera del navegador no existe esa ventaja: Word, Excel, PowerPoint, los visores de PDF y cualquier aplicación de terceros son procesos ajenos, y cada uno expone su contenido por una vía distinta o no lo expone en absoluto.

El repositorio ya tiene las tres piezas necesarias y ninguna hay que construirla desde cero:

- `DesktopWindowControls.listWindows` enumera ventanas con título, proceso y pid en Windows y Linux.
- El handler `get-screen-sources` ya pide `desktopCapturer.getSources` con `types: ['screen', 'window']` y devuelve miniaturas.
- El sidecar `python/tools_sidecar/documents.py` convierte `.pdf`, `.xlsx`, `.xlsm`, `.pptx` y `.docx` a Markdown conservando tablas.

Lo que falta es el pegamento: decidir por cada ventana **de dónde** sacar el contenido, y decirle al usuario y al modelo con qué fidelidad se obtuvo.

## Goals / Non-Goals

Objetivos:

- Paridad de ergonomía con "Añadir pestañas": abrir, marcar varias, ver chips, enviar.
- Fidelidad máxima alcanzable por aplicación, con degradación automática y silenciosa para el usuario pero explícita para el modelo.
- Coste cero cuando el usuario solo abre el menú y no marca nada.
- Ninguna lectura sin selección explícita.

No objetivos:

- Escribir en las aplicaciones abiertas. La cascada es de solo lectura, incluido el acceso COM.
- Sustituir a `desktop-agent`. Este flujo lee un estado; el agente de escritorio ejecuta acciones.
- Observación continua. No hay suscripción ni refresco automático del contenido adjunto.
- Paridad de fidelidad multiplataforma en esta entrega.

## Decisions

### Cascada de tres niveles con procedencia declarada

Cada aplicación marcada se resuelve por el primer nivel que entregue contenido útil:

| Nivel | Vía | Cubre | Fidelidad |
|---|---|---|---|
| A | COM resuelve la ruta del documento abierto → sidecar `documents.py` | Word, Excel, PowerPoint | Texto y tablas exactos, documento completo |
| B | UIA `TextPattern` sobre el `hwnd` de la ventana | Editores, visores, apps con accesibilidad | Texto plano, sin estructura tabular fiable |
| C | Captura de la ventana vía `desktopCapturer` | Cualquier ventana | Solo lo visible, leído por visión |

El nivel usado viaja en el adjunto y se muestra en el chip. El bloque de contexto que recibe el modelo abre con la procedencia, de modo que un contenido de nivel C nunca se presenta con la misma autoridad que uno de nivel A.

La alternativa de un único nivel se descartó por los extremos: solo captura pierde precisión numérica en Excel y no ve nada fuera de pantalla; solo UIA deja Excel en las celdas visibles y no funciona fuera de Windows; solo COM cubre tres aplicaciones y deja el resto sin nada.

### Nivel A: COM únicamente para resolver rutas, nunca para leer

Word y Excel exponen sus documentos abiertos en la Running Object Table. Se consulta `Word.Application.Documents` y `Excel.Application.Workbooks` para obtener `FullName` y `Saved`, y ahí termina el uso de COM: el contenido se lee después desde el disco con el sidecar, que ya está probado y acotado.

Esto evita dos problemas. Primero, leer el documento por COM implicaría recorrer el modelo de objetos de Office desde PowerShell, lento y frágil. Segundo, mantener el uso de COM en un único método de solo lectura hace trivial verificar que este flujo no puede modificar el documento del usuario.

Cuando `Saved` es falso el archivo en disco está desactualizado respecto a lo que el usuario ve. No se descarta el nivel A por eso —seguiría siendo el contenido más completo disponible— pero el adjunto se marca como desactualizado y el bloque de contexto lo declara, para que el modelo no afirme como vigentes unas cifras que el usuario acaba de cambiar sin guardar.

Si COM no resuelve ruta, o el documento nunca se guardó, o la extensión no está entre las soportadas por el sidecar, se cae a nivel B.

### Nivel B: UIA por ventana, no por primer plano

El extractor UIA actual, `GET_FOREGROUND_UI_ELEMENTS_SCRIPT`, arranca en `GetForegroundWindow` y filtra a 60 elementos **interactivos**. Sirve para decidir dónde hacer clic, no para leer un documento, y obligaría a traer al frente cada ventana marcada.

Se añade un extractor distinto, en su propio módulo, que parte del `hwnd` recibido y recorre `TextPattern` para acumular texto en orden de lectura con un tope de caracteres. El extractor existente no se toca: son dos propósitos diferentes sobre la misma tecnología y mezclarlos degradaría el agente de escritorio.

### Nivel C: la miniatura del selector no es la captura

`get-screen-sources` pide miniaturas de 320×180, suficientes para el selector y baratas de generar para todas las ventanas a la vez. Para el nivel C se hace una segunda petición acotada a la ventana elegida y con `thumbnailSize` legible. Así abrir el menú sigue siendo barato aunque haya veinte ventanas abiertas.

### Extracción al marcar, no al enviar

La intuición inicial fue replicar el patrón de las pestañas —resumen al marcar, texto completo en `handleSend`— para no pagar extracciones de aplicaciones que el usuario marca y desmarca mientras piensa. No se sostiene contra el requisito de procedencia: el chip tiene que declarar el **nivel usado**, y si la lectura ocurre al enviar, el usuario se entera cuando ya no puede hacer nada con esa información. Saber que el modelo recibirá una captura y no la hoja de cálculo cambia lo que uno escribe.

Marcar una aplicación dispara su lectura en segundo plano y el chip pasa de "leyendo…" al nivel real con sus avisos. Desmarcarla descarta el resultado: el refresco busca la entrada en la lista y, si ya no está, no la reintroduce. Al enviar solo se espera lo que siga en curso, acotado por el presupuesto del turno; lo que no llegue se declara como no leído en lugar de retener el mensaje.

El coste de la churn existe y se acepta: es el precio de que el usuario decida informado.

### Contrato IPC de cuatro capas

Dos canales nuevos bajo `desktop-context:`, cada uno con servicio en main, handler, entrada en la allowlist del preload y wrapper tipado en el renderer:

- `desktop-context:list-apps` devuelve el inventario de ventanas candidatas.
- `desktop-context:capture-app` extrae el contenido de una ventana concreta y devuelve contenido, nivel, procedencia y avisos.

El inventario excluye las ventanas del propio Pulse Hub, para que el usuario no pueda adjuntar el chat a sí mismo.

### Plataformas

Windows recibe la cascada completa. macOS y Linux quedan en nivel C, que `desktopCapturer` cubre sin trabajo adicional; en Linux el inventario ya funciona vía `xdotool`. La degradación se declara en la respuesta del inventario para que la interfaz no prometa fidelidad que la plataforma no puede dar.

## Risks / Trade-offs

- **Contenido desactualizado en nivel A.** Mitigado con la marca de cambios sin guardar en el chip y en el contexto, no ocultándolo.
- **Títulos de ventana sensibles en el inventario.** El nombre de un archivo puede revelar información. El inventario se queda en el proceso del renderer del chat, no se persiste y no sale del equipo salvo que el usuario marque esa aplicación.
- **Coste de PowerShell por ventana.** Los niveles A y B invocan PowerShell. Con presupuesto por nivel y extracción diferida al envío el coste se acota, pero marcar muchas aplicaciones a la vez es lento por construcción; el límite por turno también sirve de freno.
- **Office con varias instancias.** La Running Object Table devuelve una instancia por ProgID. Con dos procesos de Excel independientes puede no resolverse el libro de la ventana marcada; en ese caso se cae a nivel B en lugar de adjuntar el documento equivocado, y la comparación se hace contra el nombre de archivo del título de la ventana antes de aceptar la ruta.
- **Volumen de contexto.** Un Excel grande convertido a Markdown puede desbordar el turno. Se aplican tope por aplicación y tope por turno, con truncado declarado en el propio bloque.

## Migration Plan

No hay datos que migrar ni contratos existentes que romper: la capacidad es aditiva y los canales son nuevos. El selector de pestañas actual no cambia de comportamiento; solo comparte el área de chips y el presupuesto de contexto del turno.

Rollback: la capacidad queda tras una bandera de configuración. Desactivarla oculta la entrada del menú y deja de registrar los handlers; el chat vuelve al comportamiento actual sin tocar el navegador integrado ni el agente de escritorio.
