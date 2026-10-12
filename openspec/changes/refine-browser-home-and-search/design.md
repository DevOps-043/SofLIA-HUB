# Diseño

- DEC-REFINE-01: conservar documento estático, CSP y tokens compartidos. Retirar
  cabecera, pie y anillos. Animar sólo transform y opacity del logo y su luz.
- DEC-REFINE-02: Enter usa una sugerencia sólo al seleccionarla con las flechas;
  el hover no cambia el destino. Una dirección vacía no navega. En inicio vacío
  no se consulta historial automáticamente.
- DEC-REFINE-03: mostrar el inicio en el renderer existente en modo simple. HTML
  y CSS estáticos compartidos evitan mantener dos diseños. La vista nativa local
  sigue disponible para agentes, pestañas divididas y ventanas separadas; el
  renderer declara `homeInShell` en el contrato de viewport existente. Sólo la
  portada local oculta su superficie nativa y conserva sus dimensiones completas.
- DEC-REFINE-04: las sondas de Chromium muestran 2,4 s incluso con un documento
  vacío al crear una vista y 14–17 ms al recargar una existente. Cambiar texto por
  bytes no reduce ese arranque. El inicio interactivo en el renderer elimina esa
  espera visible sin pools de procesos ni cambios globales en su aislamiento.
- DEC-REFINE-05: mientras se carga un destino, `getURL()` todavía puede devolver
  el documento anterior. Conservar el destino solicitado hasta `did-navigate`;
  así el estado no revive Google ni oculta prematuramente la portada.

## Límites
La búsqueda explícita continúa usando el proveedor actual. No se modifica el
contenido ni la sesión de páginas externas. No se promete un tiempo de carga
de sitios remotos ni un resultado de FPS sin medirlo.
En páginas externas se conserva el recorte de viewport de las sugerencias del
cambio anterior; esta revisión elimina el desplazamiento de la portada local.
