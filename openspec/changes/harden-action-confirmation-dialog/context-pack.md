# Contexto del cambio

- Objetivo: confirmar acciones por teclado con foco/modalidad reales y revisión renovada al cambiar solicitud, sin ampliar autorización.
- Usuario o actor: persona que revisa una acción del chat en ConfirmActionModal.
- Alcance: componente renderer, identidad efímera de solicitud y consumidor ChatModals; arnés Chromium/AX/zoom/movimiento y pruebas de contratos.
- No objetivos: migrar todos los diálogos, declarar conformidad WCAG, lector de pantalla, permisos main, políticas de aprobación permanente, shell real o cuentas.
- Restricciones: rama acumulativa codex/reduce-technical-debt con 29 unidades y trabajo ajeno; no trasladarla a un checkout limpio. Sin secretos/.env, commit, push o despliegue. Skills enriquecer/verificar/revisión adversarial/docs aplicadas.
- Contratos afectados: props renderer con identidad opcional de solicitud; ChatModals delega resolución al dueño existente. Sin nuevos IPC, permisos, persistencia o dependencias.
- Riesgo/HITL: Cancelar o título de contenido largo reciben foco inicial; Tab no llega al fondo, Escape cancela, cerrar restaura foco. Una solicitud nueva de igual texto también renueva foco. La UI no borra por su cuenta otra solicitud después de resolver una obsoleta.
- Criterios verificables: reproducir foco/Escape/IDs y fondo no modal; pruebas de apertura/cierre/StrictMode y cambios visibles/identidad; API de decisión vigente sin permisos nuevos; Electron oculto con teclado nativo, AX, ambos temas, 200% y movimiento reducido sobre datos ficticios; gate/build con fuentes estables. Revisión visual separada, pendiente por capturas defectuosas y rechazo de apertura del archivo local por la política del navegador.
- Incertidumbres: jsdom no implementa modalidad nativa; sus dobles sólo prueban integración y eventos controlados. Nativo Windows/x64 no equivale a otras plataformas ni lector de pantalla. Captura global de teclas fuera del diálogo conserva su propio contrato.
