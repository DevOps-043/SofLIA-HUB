# Decisiones

- DEC-FLUID-01: medir el borde inferior de las sugerencias con ResizeObserver;
  descontar su solapamiento del viewport. La página permanece visible y no se
  captura al escribir. Al cerrar, desmontar o cambiar de perfil se libera el
  espacio. Gestores y avisos conservan su política actual.
- DEC-FLUID-02: recordar la emulación aplicada por WebContents con WeakMap.
  Comparar factor y tamaño efectivo; invalidar al comenzar una carga. En el
  camino nativo comprobar el factor actual antes de modificarlo.
- LIM-FLUID-01: alternar a una pestaña suspendida todavía exige recargarla; se
  conserva el presupuesto de ocho vistas vivas. La latencia de servidores
  externos no se atribuye a estas mejoras.

Rollback: revertir únicamente el diff de este cambio, sin retirar trabajo previo.
