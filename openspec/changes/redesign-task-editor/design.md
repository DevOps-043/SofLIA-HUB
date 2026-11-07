## Decisiones

Reutilizar ProjectDialog y el selector accesible existente. Mantener el editor separado visualmente del tablero mediante portal y diálogo nativo. La capa nativa del navegador ya reconoce data-native-browser-overlay.

Las fases comparten catálogo con el tablero. status_id identifica estados reales; status_stage solicita una fase ausente y nunca se guarda en task_issues. Pendientes usa tipo persistido todo y nombre independiente. Las escrituras de estados se autorizan por el equipo y usan un ID determinista por equipo/fase para evitar duplicados concurrentes; los estados existentes se reutilizan.

started_at y external_links pertenecen a IRIS. Las referencias no conceden permisos al proveedor y se abren con el navegador integrado existente. No cargar imágenes remotas automáticamente. Un cambio conserva referencias heredadas desconocidas y no las sobrescribe al editar otros campos.

## Fallos y reversión

Errores conservan el borrador; resultados inciertos bloquean repetición. Crear una fase y guardar la tarea son escrituras separadas: un fallo posterior puede dejar una fase vacía, que puede reutilizarse. No borrar automáticamente estados compartidos. No crear fases hasta validar referencias y fechas.

La reversión retira el editor y los campos opcionales del contrato; los datos existentes se conservan. No se ejecutan operaciones remotas en desarrollo.
