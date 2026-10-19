# Menú flotante de conversaciones

## Problema y alcance

El menú de los tres puntos se renderiza dentro de la lista desplazable de chats.
El overflow de la barra lateral recorta las opciones del último chat. Aumentar
su z-index no permite salir de ese recorte.

Renderizar el menú fuera de la lista, anclado al botón y limitado al viewport.
Abrir hacia arriba si falta espacio debajo, conservar las acciones y permisos,
cerrar con Escape o clic exterior y admitir navegación por teclado. Ajustar la
posición al desplazar o redimensionar. No cambiar persistencia, IPC ni el diseño
de las conversaciones.

## Verificación

Pruebas de portal, límites, reposicionamiento, teclado y acciones sin seleccionar
el chat subyacente. Comprobar geometría real en Chromium y ejecutar las compuertas
del repositorio. Reversión: retirar únicamente este cambio de presentación.
