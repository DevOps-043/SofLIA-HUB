
import { describe, expect, it } from 'vitest';
import { DECK_BASE_CSS } from '../organization-branding/deck-base-css';
import { DECK_BASE_JS } from '../organization-branding/deck-base-js';

/**
 * El sistema de diseno lo escribe el sistema y el modelo compone encima, asi
 * que un defecto aqui sale en TODAS las presentaciones. Estas comprobaciones
 * fijan los tres que se vieron en pantalla: el pie encimado sobre el texto, el
 * contenido recortado sin avisar y el texto ilegible sobre imagen.
 */
describe('sistema de diseno de las presentaciones', () => {
  /** Devuelve el cuerpo de una regla por su selector exacto. */
  function regla(selector: string): string {
    const inicio = DECK_BASE_CSS.indexOf(`\n${selector} {`);
    if (inicio === -1) throw new Error(`No existe la regla "${selector}"`);
    const desde = DECK_BASE_CSS.indexOf('{', inicio);
    return DECK_BASE_CSS.slice(desde + 1, DECK_BASE_CSS.indexOf('}', desde));
  }

  it('llega completa y con las llaves balanceadas', () => {
    expect(DECK_BASE_CSS.length).toBeGreaterThan(8_000);
    expect((DECK_BASE_CSS.match(/\{/g) ?? []).length).toBe((DECK_BASE_CSS.match(/\}/g) ?? []).length);
  });

  it('la baraja horizontal deja alcanzar lo que no cabe', () => {
    // Respaldo si el guion no se ejecuta: sin esto quedaba recortado.
    expect(regla('.baraja--horizontal > .diapositiva')).toContain('overflow-y: auto');
  });

  it('el pie va en flujo, no encima del contenido', () => {
    // Estaba en posicion absoluta al fondo y el contenido centrado por encima:
    // en cuanto la diapositiva traia mas texto, se superponian.
    expect(regla('.pie')).not.toContain('position: absolute');
    expect(regla('.pie')).toContain('margin-top');
  });

  it('la diapositiva crece en vez de recortar lo que no cabe', () => {
    const diapositiva = regla('.diapositiva');
    expect(diapositiva).toContain('min-height: 100vh');
    expect(diapositiva).not.toContain('overflow: hidden');
  });

  it('con el guion la diapositiva se queda en la ventana en vez de crecer', () => {
    // Al crecer, la altura de la diapositiva pasaba a ser la del contenido: el
    // ajuste comparaba contra ella, concluia que todo cabia y el texto se salia
    // por abajo. Es el desbordamiento que se veia en toda baraja vertical.
    const conGuion = regla('.deck-js .diapositiva');
    expect(conGuion).toContain('max-height: 100vh');
    // Y lo que sobre tras reducir sigue siendo alcanzable, nunca recortado.
    expect(conGuion).toContain('overflow-y: auto');
  });

  it('al imprimir se suelta el tope de la ventana', () => {
    const impresion = DECK_BASE_CSS.slice(DECK_BASE_CSS.indexOf('@media print'));
    expect(impresion).toContain('max-height: none');
    expect(impresion).toContain('overflow: visible');
  });

  it('el velo sobre la imagen oscurece sea cual sea el color de la marca', () => {
    const velo = regla('.imagen-fondo::after');
    // Mezclar solo con el color primario producia un velo CLARO en marcas
    // claras, y encima iba texto oscuro: ilegible.
    expect(velo).toContain('rgb(0 0 0');
    expect(velo).toContain('var(--marca-color-primario)');
  });

  it('el texto sobre imagen usa la pareja de contraste, no un color de marca', () => {
    expect(regla('.diapositiva--imagen')).toContain('var(--sobre-oscuro)');
    expect(regla('.diapositiva--imagen')).not.toContain('var(--marca-color-fondo)');
    expect(DECK_BASE_CSS).toContain('--sobre-oscuro:');
    expect(DECK_BASE_CSS).toContain('--sobre-claro:');
  });

  it('ofrece interaccion al pasar el cursor y variedad de superficie', () => {
    expect(regla('.tarjeta')).toContain('transition');
    expect(regla('.tarjeta:hover')).toContain('translateY');
    expect(DECK_BASE_CSS).toContain('.tarjeta--pleno');
    expect(DECK_BASE_CSS).toContain('.tarjeta--filo');
  });

  it('ofrece graficas sin librerias y ambiente de fondo', () => {
    expect(DECK_BASE_CSS).toContain('.anillo');
    expect(DECK_BASE_CSS).toContain('conic-gradient');
    expect(DECK_BASE_CSS).toContain('.medidor');
    expect(regla('.halo')).toContain('pointer-events: none');
  });

  it('la entrada se dispara al activarse la diapositiva, no por scroll', () => {
    // Con scroll-snap el salto recorre entero el rango de `view()` en lo que
    // dura el salto: la animacion ocurria pero era imperceptible.
    // Ya no queda ninguna declaracion: solo la mencion en el comentario que
    // explica por que se retiro.
    expect(DECK_BASE_CSS).not.toMatch(/^\s+animation-timeline:/m);
    expect(DECK_BASE_CSS).toContain('.deck-js .diapositiva.activa .aparece');
    // Y con animaciones por tiempo el retardo SI se aplica.
    expect(regla('.retardo-1')).toContain('animation-delay');
  });

  it('sin el guion todo queda visible: nunca una baraja en blanco', () => {
    // El estado inicial oculto depende de una clase que pone el guion.
    const ocultos = DECK_BASE_CSS.slice(DECK_BASE_CSS.indexOf('.deck-js .aparece,'));
    expect(ocultos.slice(0, 200)).toContain('opacity: 0');
    expect(DECK_BASE_CSS).not.toMatch(/^\.aparece \{[^}]*opacity: 0/m);
  });

  it('ofrece piezas de diagrama para no colocar coordenadas a mano', () => {
    expect(regla('.diagrama > svg')).toContain('max-height');
    expect(DECK_BASE_CSS).toContain('.flujo__paso');
    expect(DECK_BASE_CSS).toContain('.orbita__satelite');
  });

  it('el anillo de la orbita se dibuja sobre el radio de los satelites', () => {
    // Con un inset fijo quedaba descuadrado respecto a ellos: el diagrama se
    // veia mal hecho aunque el resto de la diapositiva estuviera bien.
    const anillo = regla('.orbita::before');
    expect(anillo).toContain('var(--radio-orbita)');
    expect(anillo).not.toContain('inset: 6rem');
  });

  it('el nucleo de la orbita no desborda su circulo', () => {
    const nucleo = regla('.orbita__nucleo');
    // Relleno proporcional y texto acotado: con un tamano fijo, un rotulo de
    // dos palabras se salia del circulo.
    expect(nucleo).toContain('padding: 14%');
    expect(nucleo).toContain('overflow-wrap');
  });

  it('los paneles de la comparativa no se estrechan hasta partir el texto', () => {
    // Con `auto` en el centro, cualquier cosa ancha ahi robaba el espacio y el
    // texto quedaba en una palabra por linea.
    expect(regla('.comparativa')).toContain('minmax(15rem, 1fr)');
    expect(regla('.comparativa')).toContain('min-content');
  });

  it('la orbita se arma al llegar la diapositiva', () => {
    expect(DECK_BASE_CSS).toContain('.deck-js .diapositiva.activa .orbita__satelite');
    expect(DECK_BASE_CSS).toContain('@keyframes anillo');
  });

  it('centra sin empujar el contenido hacia abajo cuando no cabe', () => {
    // `align-content: center` desbordaba por arriba y por abajo a la vez.
    expect(regla('.diapositiva')).toContain('align-content: safe center');
  });

  it('detiene lo que se mueve en bucle con movimiento reducido', () => {
    const reducido = DECK_BASE_CSS.slice(DECK_BASE_CSS.indexOf('@media (prefers-reduced-motion'));
    expect(reducido).toContain('.halo { animation: none; }');
    expect(reducido).toContain('.tarjeta:hover { transform: none; }');
  });

  it('con movimiento reducido el trazo del diagrama sigue viendose', () => {
    // El guion SI se instala ahora con movimiento reducido, y con el llega el
    // estado inicial de deck-js: un trazo con su guion oculto y sin animacion
    // que lo dibuje dejaria el diagrama vacio.
    const reducido = DECK_BASE_CSS.slice(DECK_BASE_CSS.indexOf('@media (prefers-reduced-motion'));
    expect(reducido).toContain('stroke-dashoffset: 0 !important');
    expect(reducido).toContain('stroke-dasharray: none !important');
  });

  it('no depende de ningun recurso remoto', () => {
    expect(DECK_BASE_CSS).not.toMatch(/@import|https?:\/\//);
  });
});

describe('guion base de las presentaciones', () => {
  it('activa la diapositiva en pantalla y la desactiva al salir', () => {
    expect(DECK_BASE_JS).toContain('IntersectionObserver');
    expect(DECK_BASE_JS).toContain("classList.add('activa')");
    // Se retira al salir para que la entrada se repita al volver: una
    // presentacion se recorre hacia delante y hacia atras.
    expect(DECK_BASE_JS).toContain("classList.remove('activa')");
  });

  it('se instala tambien con movimiento reducido, porque el ajuste es maquetacion', () => {
    // Antes cortaba con un retorno temprano y se llevaba por delante el ajuste
    // a la ventana: una diapositiva que no cabe deja el texto fuera con
    // animaciones y sin ellas.
    expect(DECK_BASE_JS).toContain('prefers-reduced-motion');
    expect(DECK_BASE_JS).not.toMatch(/if \(reducido\) return;/);
    const claseAntesDelSalto = DECK_BASE_JS.indexOf("classList.add('deck-js')");
    expect(claseAntesDelSalto).toBeGreaterThan(-1);
    expect(claseAntesDelSalto).toBeLessThan(DECK_BASE_JS.indexOf('if (!reducido)'));
  });

  it('con movimiento reducido la cifra se escribe ya en su valor final', () => {
    // No basta con saltarse el contador: el modelo puede dejar el nodo vacio
    // confiando en que lo rellena el guion.
    expect(DECK_BASE_JS).toContain('destino.toFixed(decimales)');
  });

  it('degrada mostrando todo si no hay observador', () => {
    expect(DECK_BASE_JS).toContain("typeof IntersectionObserver !== 'function'");
  });

  it('escala el contenido de una diapositiva que no cabe', () => {
    // En la baraja horizontal no hay desplazamiento vertical: lo que no cabia
    // quedaba cortado por arriba o por abajo, sin forma de alcanzarlo.
    expect(DECK_BASE_JS).toContain('diapositiva__ajuste');
    // El fondo, el halo y la retícula no son contenido y no deben encogerse.
    expect(DECK_BASE_JS).toContain("classList.contains('imagen-fondo')");
    expect(DECK_BASE_JS).toContain('paddingTop');
    // Y se rehace al cambiar el tamano de la ventana.
    expect(DECK_BASE_JS).toContain("addEventListener('resize'");
  });

  it('reduce dentro de un marco estable sin usar zoom', () => {
    expect(DECK_BASE_JS).toContain('diapositiva__marco');
    expect(DECK_BASE_JS).not.toContain('caja.style.zoom');
    expect(DECK_BASE_JS).toContain("transform = factor >= 0.999 ? '' : 'scale(");
  });

  it('mide contra el alto visible, no contra el de la diapositiva', () => {
    // Una diapositiva que crece con su contenido devuelve esa altura crecida:
    // comparada consigo misma siempre cabe, y el texto se salia por abajo.
    expect(DECK_BASE_JS).toContain('slide.parentElement');
    expect(DECK_BASE_JS).toContain('Math.min(slide.clientHeight, visible)');
    expect(DECK_BASE_JS).toContain('caja.scrollHeight');
  });

  it('no reduce mas de lo necesario', () => {
    expect(DECK_BASE_JS).toContain('disponible / natural');
  });

  it('vuelve a medir cuando las ilustraciones terminan de cargar', () => {
    // En DOMContentLoaded las imagenes aun no ocupan su alto: medir solo ahi
    // daba una altura menor que la real, no se escalaba nada, y al aparecer la
    // ilustracion el texto quedaba fuera de la pantalla.
    expect(DECK_BASE_JS).toContain('document.images');
    expect(DECK_BASE_JS).toContain("imagen.addEventListener('load'");
    expect(DECK_BASE_JS).toContain("window.addEventListener('load'");
    expect(DECK_BASE_JS).toContain("addEventListener('resize'");
  });

  it('reparte los satelites de la orbita por igual', () => {
    // Calcular los angulos a mano producia diagramas descuadrados: cuatro
    // satelites amontonados a un lado y hueco en el otro.
    expect(DECK_BASE_JS).toContain("querySelectorAll('.orbita')");
    expect(DECK_BASE_JS).toContain('360 / total');
    // Un angulo escrito a mano sigue mandando.
    expect(DECK_BASE_JS).toContain("getPropertyValue('--angulo')");
  });

  it('numera las piezas del diagrama y mide la longitud real del trazo', () => {
    expect(DECK_BASE_JS).toContain('.traza-auto, .surge-auto');
    // Sin la longitud real el dibujado se ve entrecortado o instantaneo.
    expect(DECK_BASE_JS).toContain('getTotalLength');
  });

  it('resuelve la rueda en la baraja horizontal', () => {
    expect(DECK_BASE_JS).toContain('baraja--horizontal');
    expect(DECK_BASE_JS).toContain("addEventListener('wheel'");
    expect(DECK_BASE_JS).toContain('navegacionBloqueada');
    expect(DECK_BASE_JS).toContain('indiceVisible');
    expect(DECK_BASE_JS).toContain('scrollTo');
    expect(DECK_BASE_JS).not.toContain('horizontal.scrollBy');
  });

  it('anima los contadores hasta su valor', () => {
    expect(DECK_BASE_JS).toContain('data-contador');
    expect(DECK_BASE_JS).toContain('requestAnimationFrame');
  });

  it('no pide nada a la red', () => {
    expect(DECK_BASE_JS).not.toMatch(/fetch\(|XMLHttpRequest|https?:\/\//);
  });
});
