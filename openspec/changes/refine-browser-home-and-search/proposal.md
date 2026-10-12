# Inicio y búsqueda más limpios

## Why
La portada tiene textos y círculos que el usuario pidió retirar. El buscador
resulta demasiado cuadrado; el historial puede reemplazar lo escrito al pasar
el cursor, y su desplegable desplaza el documento. La carga local necesita
mediciones que separen el acuse del tiempo hasta mostrar contenido.

## What Changes
- Simplificar la portada y usar un buscador ovalado con botón circular.
- Corregir Enter, selección por teclado y foco vacío en el inicio.
- Evitar que las sugerencias cambien la disposición del documento.
- Medir y reducir el trabajo innecesario al cargar el inicio, conservando Chromium.

## Impact
Portada interna, barra de direcciones, composición nativa y pruebas asociadas.
Sin nuevas dependencias ni acceso adicional del documento a APIs nativas.
