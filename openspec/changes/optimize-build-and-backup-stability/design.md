# Diseño

La instalación Zoom se considera reutilizable si manifiesto, locks y versiones de paquetes instalados concuerdan y existen los directorios SDK. Ante ausencia o divergencia se ejecuta el mismo npm ci con scripts bloqueados; `zoom:install` conserva la reinstalación explícita. No es una auditoría criptográfica del contenido instalado.

TypeScript guarda dos archivos de caché en node_modules/.cache. Una compilación fría conserva todas las comprobaciones. La fachada Google usa subrutas de googleapis fijado por lock; actualizar la dependencia exige comprobar esas rutas. Expone únicamente calendar, drive, gmail, chat, oauth2 y auth, sin cargar el índice global. Los mocks interceptan esa frontera local.

React.lazy difiere ajustes hasta abrir el modal y productividad hasta seleccionarla, con estado de carga en español. El watcher ignora worktrees y artefactos voluminosos generados.

El scheduler de respaldos conserva la fecha objetivo y divide esperas en tramos de hasta 2147483647 ms. Programa el próximo plazo después de terminar el trabajo, también tras errores. Una generación invalida callbacks al detener o cambiar intervalo. Valida intervalos positivos finitos representables y no mantiene vivo el proceso con el timer.

Reversión: revertir este diff; las cachés son descartables. No se modifican datos ni se producen efectos externos. Los cierres reportados requieren dumps para atribuir una causa definitiva.
