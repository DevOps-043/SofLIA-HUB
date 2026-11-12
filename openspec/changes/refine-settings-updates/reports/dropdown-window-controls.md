# Selector de versiones y controles superiores

Estado: implementado y verificado el 11 de noviembre de 2026.

El historial usa el combobox/listbox compartido SelectDropdown: fecha secundaria, versión instalada marcada, desplazamiento acotado, teclado y Escape que cierra primero la lista. Se retiró el select nativo, sin duplicar lógica de selección ni cambiar la fuente de versiones.

El fondo de Configuración ahora comienza debajo de la barra de ventana. window-chrome.css comparte las alturas con AppTitleBar y BrowserTabStrip; el modal calcula su altura con el espacio restante. No se duplicaron botones ni cambiaron handlers nativos o IPC.

Verificación en el directorio activo: 60 pruebas de SelectDropdown, historial, interacción de ajustes y pestañas aprobadas; typecheck, ESLint dirigido, harness y docs:check aprobados. git diff --check aprobado.

QA nativo real: se abrió Configuración y Sistema y actualizaciones en la cuenta existente. El desplegable mostró lista propia con fechas y marca Instalada. La barra superior siguió visible. Se pulsó Maximizar con Configuración abierta: la ventana se maximizó y el modal continuó abierto. No se instalaron versiones ni se cambiaron preferencias.

Evidencia: [dropdown-window-controls.png](dropdown-window-controls.png).

verify:pr aprobó adaptadores, arnés, cadena de suministro, documentación, semilla, OpenSpec, pruebas de calidad y typecheck. Se detuvo en lint:changed por los mismos 9 errores y una advertencia de la gestión de carpetas (useAppViewHandlers-deleteFolder, AppModals y DeleteFolderModal), ajenos a este ajuste. El lint dirigido de los archivos propios aprobó. No se declara aprobada la compuerta general ni se atribuye una suite completa a este ajuste.

Revisión independiente de sólo lectura: sin regresiones funcionales nuevas en selección, alturas compartidas y reserva de la fila nativa. La revisión no ejecutó pruebas; la evidencia automatizada y visual descrita arriba corresponde al ejecutor principal.
