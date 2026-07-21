# Aplicar un cambio OpenSpec

Implementa un cambio aprobado sin perder trazabilidad.

1. Lee todos los artefactos de `openspec/changes/<nombre>/` y la skill del area.
2. Confirma el estado Git y preserva cualquier trabajo ajeno.
3. Ejecuta las tareas en orden; manten cada tarea pequena y marca su casilla solo
   cuando la implementacion y su verificacion hayan terminado.
4. Actualiza contratos, pruebas y documentacion en el mismo cambio.
5. No ejecutes migraciones, despliegues, publicaciones ni envios sin autorizacion
   explicita.
6. Registra comandos y resultados reales en `reports/` dentro del cambio.
7. Continua con `/openspec-verify` antes de declarar el cambio terminado.
