import { booleanProp, objectParams, stringProp } from './schema';
import type { GeminiToolGroup } from './types';

/**
 * Herramientas de archivo acotadas al espacio de trabajo de la Skill activa.
 *
 * Solo se declaran cuando existe un workspace vivo (ver `turn-catalog.ts`).
 * No confundir con `computer-file-tools.ts`: aquellas operan sobre cualquier
 * ruta del disco del usuario; estas, solo dentro del workspace, con rutas
 * relativas que main resuelve y valida.
 */
export const SKILL_WORKSPACE_TOOLS: GeminiToolGroup = {
  functionDeclarations: [
    {
      name: 'workspace_list_files',
      description:
        'Lista los archivos del espacio de trabajo de la skill activa con su tamano. Usala antes de editar para saber que existe ya. No accede al disco del usuario: solo a esta carpeta de trabajo.',
      parameters: objectParams({}),
    },
    {
      name: 'workspace_read_file',
      description:
        'Lee un archivo del espacio de trabajo de la skill activa. Es obligatorio leer un archivo antes de editarlo por reemplazo: sin el contenido exacto la edicion fallara.',
      parameters: objectParams({
        path: stringProp('Ruta del archivo relativa al espacio de trabajo, por ejemplo "index.html" o "estilos/presentacion.css".'),
      }, ['path']),
    },
    {
      name: 'workspace_write_file',
      description:
        'Crea o reemplaza por completo un archivo del espacio de trabajo. Usala para crear archivos nuevos. Para modificar un archivo que ya existe usa workspace_edit_file: sobrescribir destruiria el contenido que el usuario no pidio cambiar.',
      parameters: objectParams({
        path: stringProp('Ruta del archivo relativa al espacio de trabajo. Debe ser relativa: las rutas absolutas se rechazan.'),
        content: stringProp('Contenido completo del archivo.'),
      }, ['path', 'content']),
    },
    {
      name: 'workspace_edit_file',
      description:
        'Modifica un archivo existente reemplazando un fragmento exacto por otro. Falla sin tocar el archivo si el fragmento no existe o si aparece mas de una vez: en ese caso amplia el contexto del fragmento hasta que sea unico. Es la forma correcta de aplicar cambios acotados.',
      parameters: objectParams({
        path: stringProp('Ruta del archivo relativa al espacio de trabajo.'),
        search: stringProp('Fragmento exacto que debe reemplazarse, tal cual aparece en el archivo.'),
        replace: stringProp('Texto que sustituye al fragmento.'),
        replace_all: booleanProp('Si es true, reemplaza todas las ocurrencias. Solo cuando el usuario pidio un cambio global.'),
      }, ['path', 'search', 'replace']),
    },
    {
      name: 'workspace_generate_image',
      description:
        'Genera una ilustracion con IA y la guarda en assets/. Devuelve la ruta relativa que debes usar en el HTML o el CSS. Su valor esta en la SERIE: pasa siempre la MISMA direccion de arte en "art_direction" para que todas las ilustraciones de la baraja parezcan de la misma mano. Una serie coherente es lo que separa una presentacion de agencia de un collage de imagenes sueltas. No la uses para datos ni etiquetas: el modelo de imagen escribe mal el texto, asi que las cifras y los rotulos van en HTML o SVG encima o al lado de la ilustracion.',
      parameters: objectParams({
        prompt: stringProp('Motivo concreto de ESTA imagen, en ingles y sin estilo: el estilo va aparte. Por ejemplo "an isolated rigid pyramid next to an interconnected mesh of nodes".'),
        art_direction: stringProp('Direccion de arte de la baraja, en ingles, IDENTICA en todas las llamadas: tecnica, paleta con sus valores, grosor de trazo, fondo y acabado. Definela una vez al empezar y repitela literalmente.'),
        file_name: stringProp('Nombre del archivo, por ejemplo "jerarquia-vs-nodos.png". Solo letras, numeros y guiones.'),
      }, ['prompt', 'art_direction', 'file_name']),
    },
    {
      name: 'workspace_download_image',
      description:
        'Descarga una imagen desde una URL HTTPS publica y la guarda en assets/. Usala cuando la fuente que estas usando ya tiene una imagen adecuada, por ejemplo una de la pagina abierta en el navegador. Devuelve la ruta relativa. Solo acepta HTTPS y formatos PNG, JPEG o WebP.',
      parameters: objectParams({
        url: stringProp('URL HTTPS completa de la imagen.'),
        file_name: stringProp('Nombre del archivo destino, por ejemplo "producto.png".'),
      }, ['url', 'file_name']),
    },
  ],
};
