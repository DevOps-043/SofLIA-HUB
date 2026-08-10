import { describe, expect, it } from 'vitest';
import { PRESENTACIONES_SKILL_PROMPT } from '../../prompts/skills/presentaciones';

/**
 * El prompt es un literal de plantilla largo con muchas comillas invertidas
 * escapadas. Una sin escapar cierra la cadena antes de tiempo y el modelo
 * recibe un contrato truncado —el compilador lo detecta solo si el resto ya
 * no es TypeScript valido, cosa que no siempre pasa—. Estas comprobaciones
 * verifican que llega entero y que dice lo que debe decir.
 */
describe('contrato de la skill de presentaciones', () => {
  it('llega completo hasta la ultima seccion', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('PARTE 1');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('PARTE 2');
    // Ultimo bloque del contrato: si el literal se cerro antes, falta.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Contenido de las fuentes');
    expect(PRESENTACIONES_SKILL_PROMPT.length).toBeGreaterThan(4000);
  });

  it('prohibe los emojis y exige iconos dibujados', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('PROHIBIDOS LOS EMOJIS');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('SVG en linea');
  });

  it('pide movimiento y respeto por la preferencia de movimiento reducido', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Transicion entre diapositivas');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('prefers-reduced-motion');
  });

  it('exige graficas con datos reales, nunca inventados', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NUNCA inventes datos');
  });

  it('mantiene las reglas que no se negocian', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('estilos/marca.css');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Sin recursos remotos');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('--marca-color-primario');
  });

  it('manda componer con el sistema de diseno, no reinventarlo', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('estilos/base.css');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.titular');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.aparece');
  });

  it('pide navegacion por scroll y prohibe botones de paginacion', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Navegacion por SCROLL');
    // La seccion antigua pedia flechas y contador manual: contradecia el
    // scroll-snap y dejaba al modelo escribiendo JavaScript innecesario.
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('Incluye navegacion con teclado');
  });

  it('permite JavaScript para diseno y movimiento, pero no remoto', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('JavaScript: usalo para el diseno y el movimiento');
    // La version anterior lo desalentaba; el producto decidio lo contrario.
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('Si no, no escribas ninguno');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Ninguna libreria remota');
  });

  it('exige profundidad y no titulares genericos', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Profundidad del contenido');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Agota la fuente antes de escribir');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Cada afirmacion se apoya en algo concreto');
  });

  it('documenta las dos herramientas de imagen y su frontera', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('workspace_generate_image');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('workspace_download_image');
    // El modelo de imagen escribe mal: los rotulos van en HTML o SVG, donde
    // ademas se pueden animar y quedan legibles en cualquier pantalla.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Rotulos dentro de la ilustracion: solo los imprescindibles');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('assets/');
  });

  it('deja elegir el sentido del desplazamiento y resuelve la trampa del horizontal', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('baraja--horizontal');
    // La rueda desplaza en vertical: sin el manejador la baraja horizontal
    // parece congelada, asi que el prompt entrega el fragmento exacto.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain("addEventListener('wheel'");
  });

  it('exige entrada escalonada en toda diapositiva y varios gestos de entrada', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('obligatoria en TODA diapositiva');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.aparece--izquierda');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.aparece--barrido');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.palabras');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.retardo-6');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.cascada');
  });

  it('obliga a enlazar el guion base, sin el cual no hay animacion', () => {
    // Las entradas estaban ligadas al scroll y el salto de scroll-snap las
    // consumia de golpe: eran imperceptibles. Ahora las dispara este guion.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('<script src="guion-base.js">');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NO HAY NINGUNA ANIMACION');
  });

  it('da piezas para los diagramas en vez de coordenadas a mano', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Un flujo o un proceso NO es un SVG');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.flujo__paso');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.orbita__satelite');
    // Sin este envoltorio un SVG propio se sale de la diapositiva.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('class="diagrama"');
  });

  it('exige una pieza visual por diapositiva de contenido', () => {
    // Cuatro imagenes en quince diapositivas no llegan a la calidad pedida.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('una pieza visual por diapositiva de contenido');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('entre seis y diez seran ilustraciones generadas');
  });

  it('prohibe reintentar a ciegas una edicion fallida', () => {
    // El sintoma: quince intentos identicos, ninguno aplicado.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NO la repitas adivinando');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Dos fallos seguidos');
  });

  it('prohibe abrir la presentacion en un navegador para verificarla', () => {
    // Sin conocer la ruta real, cualquier direccion que construya apunta a un
    // archivo inexistente y el usuario ve una pagina en blanco.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NUNCA abras la presentacion en un navegador');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Tu comprobacion es leer el archivo');
  });

  it('prohibe dejar medio lienzo vacio y repetir la misma caja', () => {
    // Los dos sintomas visibles de una baraja generada.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Reparto del espacio');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('LLENA LAS DOS');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('no repitas la misma caja');
  });

  it('libera al modelo de calcular angulos e indices del diagrama', () => {
    // Calcularlos a mano producia orbitas descuadradas.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('No calcules angulos');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Tu no escribes indices ni longitudes');
  });

  it('pide cifras que cuentan al entrar', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('data-contador');
  });

  it('ordena las vias de imagen y prefiere la de la propia fuente', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('La imagen que ya trae la fuente');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('read_browser_dom');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('imagen-fondo');
  });

  it('exige una direccion de arte unica para toda la baraja', () => {
    // Es lo que separa una serie ilustrada de un collage de imagenes sueltas,
    // y por eso viaja como parametro de la herramienta y no como recordatorio.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Sistema de ilustracion');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('art_direction');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('identica en todas las llamadas');
    // Con un ejemplo concreto: sin valores, el modelo escribe generalidades.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Technical blueprint illustration');
  });

  it('ofrece composiciones densas y acabado tecnico', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.rail__bloques');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.bloque--con-apoyo');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('.plano');
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('Densidad con estructura');
  });

  it('prohibe inventar rutas de disco en el chat', () => {
    // El modelo solo maneja rutas relativas: cualquier ruta absoluta que
    // escriba es inventada y manda al usuario a un archivo inexistente.
    expect(PRESENTACIONES_SKILL_PROMPT).toContain('NUNCA escribas una ruta de disco en el chat');
  });

  it('no deja marcadores de plantilla sin resolver', () => {
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('${');
    expect(PRESENTACIONES_SKILL_PROMPT).not.toContain('undefined');
  });
});
