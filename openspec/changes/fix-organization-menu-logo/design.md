## Decisiones
- Usar `logo_url` antes de `brand_favicon_url` tanto para la organización activa como para las filas del selector. Ambos campos ya pertenecen al contrato y a la consulta de perfil.
- Compartir un componente de imagen que descarta candidatos vacíos y duplicados y avanza ante errores de carga. Cambiar de organización o actualizar URLs restablece los candidatos.
- Mantener proporción con `object-contain` en 32 px cuadrados, sin máscaras ni superficies alrededor del logo; reservar el espacio restante al nombre visible de 15 px, sin flecha.
- El acceso expandido e inferior muestran el nombre de la organización incluso si fallan ambas imágenes; el compacto lo conserva mediante `aria-label` y `title`. Sin organización disponible se conserva la identidad personal existente.
- Separar el pie de la lista de chats sólo mediante borde superior, con fondo transparente. El separador pertenece al área del menú y no enmarca el logo.

## Límites y reversión
No se inspeccionan datos remotos ni se garantiza que todas las URLs existentes sean públicas y válidas. No se puede eliminar un fondo o margen que forme parte del propio archivo. Revertir los archivos del cambio restaura el aspecto anterior sin migración.
