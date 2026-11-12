## Decisiones
La versión instalada proviene del estado de main, con package.json como respaldo de compilación. No se fija ningún número en componentes. CHANGELOG.md, ya utilizado por release.yml, se incorpora como texto al build: cada nueva entrada publicada aparece sin editar React. Las notas de una actualización entrante se combinan por versión, sin duplicar ni reclasificar la versión instalada como disponible. No se inventan notas si falta una publicación.

La presentación del historial usa datos de texto, nunca HTML remoto. El parser reconoce títulos de versión, párrafos, secciones y viñetas multilínea, omite Sin publicar y limita la entrada. La UI selecciona la versión instalada inicialmente.

Actualizaciones distingue sin comprobar, buscando, al día, disponible, descarga, lista y error. Reutiliza el puente existente y libera únicamente sus propias suscripciones. La instalación conserva la protección nativa.

Ajustes usa navegación y subtabs consistentes, superficies de tokens, iconos duotono y animaciones breves de entrada, foco y pulsación; sin ciclos decorativos. Menú de temas y navegador conservan acciones, permisos, arrastre y límites nativos. Reduced-motion elimina movimiento.

## Verificación y reversión
Pruebas de parser, fuente canónica, versiones futuras sin cambios de UI, errores de actualización, suscripciones y acciones existentes. QA visual claro/oscuro, teclado, viewport estrecho y movimiento reducido. La reversión restaura los archivos del renderer; no cambia datos ni versiones de publicaciones existentes.

## Ajuste de selector y controles de ventana
El historial reutiliza SelectDropdown, el combobox/listbox compartido, en tamaño compacto con fecha como descripción y marca de versión instalada/disponible. Conserva teclado, foco, Escape, altura limitada y portal para no recortarse con el scroll. No incorpora otra implementación de select.

window-chrome.css centraliza la altura de la barra estándar y la del navegador. El fondo modal de Ajustes empieza debajo de esa fila y su altura se calcula con el espacio restante; deja visibles y accesibles al puntero los controles de ventana sin duplicarlos ni elevar toda la barra por encima de otros diálogos.
