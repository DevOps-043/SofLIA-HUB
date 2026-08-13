/**
 * Guion base de la baraja. Lo escribe el sistema junto a la hoja de marca y el
 * sistema de diseno, y el modelo no puede tocarlo.
 *
 * Existe por un motivo concreto: las animaciones de entrada estaban ligadas al
 * scroll (`animation-timeline: view()`), y con `scroll-snap` el salto de una
 * diapositiva a la siguiente RECORRE ENTERO el rango de entrada en el tiempo
 * que dura el salto. La animacion ocurria, pero de forma imperceptible: el
 * usuario veia el contenido ya colocado. Ligarlas a un observador y dispararlas
 * por tiempo cuando la diapositiva entra en pantalla es lo que las hace
 * visibles, y ademas devuelve los retardos escalonados, que sobre una linea de
 * tiempo de scroll no se aplican.
 *
 * Degradacion: la clase `deck-js` la pone este guion. Sin el, el CSS deja todo
 * visible y estatico. Una presentacion nunca se queda en blanco por esto.
 */
export const DECK_BASE_JS = `/* Guion base de las presentaciones de Pulse Hub.
   NO EDITAR: se reescribe en cada generacion. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A partir de aqui el CSS puede ocultar el estado inicial: solo lo hace si
  // esta clase existe, de modo que un fallo del guion nunca esconde contenido.
  //
  // Se pone TAMBIEN con movimiento reducido. El guion no solo anima: tambien
  // ajusta a la ventana lo que no cabe, y eso es maquetacion. Saltarselo dejaba
  // el texto fuera de la pantalla justo a quien menos puede perseguirlo. Las
  // entradas se saltan una por una mas abajo, y la hoja base ya neutraliza con
  // !important todo lo que se mueva.
  raiz.classList.add('deck-js');

  function alEstarListo(accion) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', accion, { once: true });
    else accion();
  }

  alEstarListo(function () {
    var diapositivas = Array.prototype.slice.call(document.querySelectorAll('.diapositiva'));
    if (!diapositivas.length) return;

    // Numera las palabras de los titulares marcados para escalonarlas sin que
    // el modelo tenga que escribir el indice a mano en cada span.
    if (!reducido) Array.prototype.forEach.call(document.querySelectorAll('.palabras'), function (bloque) {
      if (bloque.children.length) {
        Array.prototype.forEach.call(bloque.children, function (hijo, indice) {
          hijo.style.setProperty('--i', String(indice));
        });
        return;
      }
      var palabras = (bloque.textContent || '').split(/\\s+/).filter(Boolean);
      bloque.textContent = '';
      palabras.forEach(function (palabra, indice) {
        var span = document.createElement('span');
        span.textContent = palabra;
        span.style.setProperty('--i', String(indice));
        bloque.appendChild(span);
        if (indice < palabras.length - 1) bloque.appendChild(document.createTextNode(' '));
      });
    });

    // Orbitas: reparte los satelites por igual y los numera. Calcular los
    // angulos a mano producia diagramas descuadrados —cuatro satelites
    // amontonados a un lado y hueco en el otro—, que es lo que hacia que el
    // esquema se viera mal aunque el resto de la diapositiva estuviera bien.
    Array.prototype.forEach.call(document.querySelectorAll('.orbita'), function (orbita) {
      var satelites = Array.prototype.filter.call(orbita.children, function (hijo) {
        return hijo.classList.contains('orbita__satelite');
      });
      var total = satelites.length;
      satelites.forEach(function (satelite, indice) {
        satelite.style.setProperty('--i', String(indice));
        // Un angulo escrito a mano manda: el reparto solo cubre lo que falta.
        if (!satelite.style.getPropertyValue('--angulo') && !satelite.hasAttribute('data-angulo')) {
          satelite.style.setProperty('--angulo', String(Math.round((360 / total) * indice)));
        }
      });
    });

    // Numera los trazos y las piezas de cada diagrama para que se dibujen en
    // orden sin que haya que escribir el indice uno por uno.
    if (!reducido) Array.prototype.forEach.call(document.querySelectorAll('.diagrama'), function (diagrama) {
      Array.prototype.forEach.call(diagrama.querySelectorAll('.traza-auto, .surge-auto'), function (pieza, indice) {
        if (!pieza.style.getPropertyValue('--i')) pieza.style.setProperty('--i', String(indice));
        // Longitud real del trazo: sin ella, stroke-dasharray usa un valor
        // por defecto y el dibujado se ve entrecortado o instantaneo.
        if (pieza.classList.contains('traza-auto') && typeof pieza.getTotalLength === 'function') {
          try {
            var largo = Math.ceil(pieza.getTotalLength());
            if (largo > 0) pieza.style.setProperty('--largo', String(largo));
          } catch (error) { /* nodos sin geometria: se queda el valor por defecto */ }
        }
      });
    });

    // Entradas del contenido. Antes esto podia cortar la ejecucion con un
    // retorno temprano, y con ella el ajuste a la ventana que viene despues: el
    // desbordamiento no tiene nada que ver con las animaciones y no puede
    // depender de que estas se instalen.
    activarEntradas();

    function activarEntradas() {
      // Con movimiento reducido se marcan todas y no se anima ninguna: la hoja
      // base neutraliza las animaciones, pero la clase activa mantiene visible lo que
      // el estado inicial de deck-js oculta.
      if (reducido || typeof IntersectionObserver !== 'function') {
        // Sin observador se muestran todas: es preferible a una baraja en blanco.
        diapositivas.forEach(function (slide) { slide.classList.add('activa'); });
        return;
      }

      var observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('activa');
            return;
          }
          // Al salir se retira para que la entrada se repita al volver: una
          // presentacion se recorre hacia delante y hacia atras.
          entrada.target.classList.remove('activa');
        });
      }, { threshold: 0.35 });

      diapositivas.forEach(function (slide) { observador.observe(slide); });

      // La primera se activa de inmediato: al cargar ya esta en pantalla y
      // esperar al observador deja un parpadeo inicial.
      diapositivas[0].classList.add('activa');
    }

    // Contadores: cualquier elemento con data-contador sube hasta su valor
    // cuando su diapositiva se activa. Es el efecto que mas eleva una cifra.
    var contadores = Array.prototype.slice.call(document.querySelectorAll('[data-contador]'));
    contadores.forEach(function (nodo) {
      var destino = parseFloat(nodo.getAttribute('data-contador'));
      if (!isFinite(destino)) return;
      var decimales = (nodo.getAttribute('data-decimales') || '0').length ? parseInt(nodo.getAttribute('data-decimales') || '0', 10) : 0;
      var prefijo = nodo.getAttribute('data-prefijo') || '';
      var sufijo = nodo.getAttribute('data-sufijo') || '';
      var slide = nodo.closest('.diapositiva');
      var animado = false;
      // Con movimiento reducido la cifra se escribe ya en su valor final. No
      // basta con saltarse el contador: el modelo puede haber dejado el nodo
      // vacio confiando en que lo rellena el guion.
      if (reducido) {
        nodo.textContent = prefijo + destino.toFixed(decimales) + sufijo;
        return;
      }
      nodo.textContent = prefijo + (0).toFixed(decimales) + sufijo;

      function contar() {
        if (animado) return;
        animado = true;
        var inicio = 0;
        var duracion = 1100;
        function paso(marca) {
          if (!inicio) inicio = marca;
          var avance = Math.min((marca - inicio) / duracion, 1);
          // Suavizado de salida: rapido al principio, se asienta al final.
          var suave = 1 - Math.pow(1 - avance, 3);
          nodo.textContent = prefijo + (destino * suave).toFixed(decimales) + sufijo;
          if (avance < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
      }

      if (!slide) { contar(); return; }
      var vigilante = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) { if (entrada.isIntersecting) contar(); });
      }, { threshold: 0.35 });
      vigilante.observe(slide);
    });

    // Ajuste a la ventana: si el contenido de una diapositiva no cabe, se
    // reduce hasta que quepa. Sin esto, en la baraja horizontal —que no puede
    // desplazarse en vertical— el titulo quedaba cortado por arriba o por
    // abajo, y en la vertical el contenido aparecia empujado fuera de vista.
    var ENVOLTORIO = 'diapositiva__ajuste';

    function envolverContenido(slide) {
      if (slide.querySelector(':scope > .' + ENVOLTORIO)) return slide.querySelector(':scope > .' + ENVOLTORIO);
      var caja = document.createElement('div');
      caja.className = ENVOLTORIO;
      var sueltos = [];
      Array.prototype.forEach.call(slide.children, function (hijo) {
        // El fondo, el halo y la retícula no son contenido: no se escalan.
        if (hijo.classList.contains('imagen-fondo')) return;
        if (hijo.classList.contains('halo')) return;
        if (hijo.classList.contains('plano')) return;
        sueltos.push(hijo);
      });
      if (!sueltos.length) return null;
      slide.insertBefore(caja, sueltos[0]);
      sueltos.forEach(function (hijo) { caja.appendChild(hijo); });
      return caja;
    }

    function ajustar(slide) {
      var caja = slide.querySelector(':scope > .' + ENVOLTORIO);
      if (!caja) return;
      caja.style.zoom = '';
      // clientHeight incluye el relleno, y el contenido vive dentro de el:
      // restarlo evita escalar de menos y que siga sin caber.
      var estilo = window.getComputedStyle(slide);
      var relleno = parseFloat(estilo.paddingTop || '0') + parseFloat(estilo.paddingBottom || '0');
      // Contra la altura VISIBLE, no contra la de la diapositiva. Una baraja
      // generada antes de este arreglo no lleva el tope de la hoja base: la
      // diapositiva crece con su contenido, la altura medida es esa altura
      // crecida, la comparacion concluia que todo cabia y el texto se salia por
      // abajo sin que nada lo redujera. Es el fallo del desbordamiento.
      var baraja = slide.parentElement;
      var visible = baraja ? baraja.clientHeight : 0;
      var alto = visible ? Math.min(slide.clientHeight, visible) : slide.clientHeight;
      var disponible = alto - relleno - 2;
      if (!disponible || medir(caja) <= disponible) return;

      // Suelo del 50%: por debajo el problema es que sobra contenido, y letra
      // mas pequena no lo arregla. Lo que quede fuera se alcanza desplazando
      // dentro de la propia diapositiva.
      var SUELO = 0.5;

      // Primera aproximacion por regla de tres. Queda siempre del lado seguro
      // —cabe— porque al reducir encoge tambien la tipografia fluida y el alto
      // baja MAS que el factor.
      var estimado = Math.max(SUELO, disponible / medir(caja));
      aplicar(caja, estimado);
      if (estimado <= SUELO || medir(caja) > disponible) return;

      // Y por eso hace falta la segunda parte: esa misma desproporcion dejaba
      // la diapositiva mucho mas pequena de lo necesario —un cuarto del lienzo
      // vacio y la letra encogida sin motivo—. Se recupera lo que sobra
      // buscando el mayor factor que todavia cabe.
      var bajo = estimado;
      var arriba = 1;
      var mejor = estimado;
      for (var intento = 0; intento < 4; intento += 1) {
        var medio = (bajo + arriba) / 2;
        aplicar(caja, medio);
        if (medir(caja) <= disponible) {
          mejor = medio;
          bajo = medio;
        } else {
          arriba = medio;
        }
      }
      aplicar(caja, mejor);
    }

    /**
     * Alto REAL en pantalla, ya con la reduccion aplicada. Se mide asi y no con
     * scrollHeight porque scrollHeight vive en las coordenadas propias de la
     * caja, que son justo las que la reduccion cambia.
     */
    function medir(caja) {
      return caja.getBoundingClientRect().height;
    }

    /**
     * zoom y no transform: scale, porque zoom SI reduce la caja de maquetacion.
     * Con la transformacion la caja seguia midiendo lo mismo, y lo poco que
     * sobraba tras reducir obligaba a recorrer cientos de pixeles de vacio para
     * alcanzarlo.
     */
    function aplicar(caja, factor) {
      caja.style.zoom = factor >= 0.999 ? '' : factor.toFixed(3);
    }

    var pendiente = null;
    function ajustarTodas() {
      if (pendiente) cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(function () { diapositivas.forEach(ajustar); });
    }

    diapositivas.forEach(envolverContenido);
    ajustarTodas();

    // Las ilustraciones aun no han cargado en DOMContentLoaded: medir ahora da
    // una altura menor que la real, no se escala nada, y al aparecer la imagen
    // el contenido desborda y el texto queda fuera de la pantalla. Por eso se
    // vuelve a medir cuando cada imagen termina y cuando termina la pagina.
    Array.prototype.forEach.call(document.images, function (imagen) {
      if (imagen.complete) return;
      imagen.addEventListener('load', ajustarTodas, { once: true });
      imagen.addEventListener('error', ajustarTodas, { once: true });
    });
    window.addEventListener('load', ajustarTodas);

    // Y ante cualquier otro cambio de altura: fuentes que terminan de cargar,
    // un contador que ensancha su linea, una tarjeta que se despliega.
    if (typeof ResizeObserver === 'function') {
      var vigilanteAltura = new ResizeObserver(ajustarTodas);
      diapositivas.forEach(function (slide) {
        var caja = slide.querySelector(':scope > .' + ENVOLTORIO);
        if (caja) vigilanteAltura.observe(caja);
      });
    }

    window.addEventListener('resize', ajustarTodas);

    // Baraja horizontal: la rueda del raton desplaza en vertical y sin esto la
    // presentacion parece congelada.
    var horizontal = document.querySelector('.baraja--horizontal');
    if (horizontal) {
      horizontal.tabIndex = 0;
      horizontal.addEventListener('wheel', function (evento) {
        if (Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
        evento.preventDefault();
        horizontal.scrollBy({ left: evento.deltaY, behavior: 'auto' });
      }, { passive: false });
    }
  });
})();
`;
