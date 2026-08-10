import { describe, expect, it } from 'vitest';
import { highlightCode, languageForPath } from '../../components/presentation/code-highlight';

describe('resaltado del codigo de la presentacion', () => {
  it('reconoce los lenguajes que produce la skill', () => {
    expect(languageForPath('index.html')).toBe('xml');
    expect(languageForPath('estilos/presentacion.css')).toBe('css');
    expect(languageForPath('guion.md')).toBe('markdown');
  });

  it('no resalta lo que no reconoce', () => {
    expect(languageForPath('assets/logo.png')).toBeNull();
    expect(highlightCode('assets/logo.png', 'binario')).toBeNull();
  });

  it('marca las etiquetas del HTML', () => {
    const resultado = highlightCode('index.html', '<section class="diapositiva">Hola</section>');

    expect(resultado).toContain('hljs-tag');
    expect(resultado).toContain('hljs-attr');
  });

  it('marca las propiedades del CSS', () => {
    const resultado = highlightCode('estilos/presentacion.css', '.diapositiva { transition: opacity 300ms }');

    expect(resultado).toContain('hljs-selector-class');
  });

  it('escapa el marcado del contenido en cada lenguaje', () => {
    // El codigo lo escribe un modelo y se pinta con dangerouslySetInnerHTML.
    // La propiedad que importa no es como queda partido el resaltado, sino
    // que del origen no salga ninguna etiqueta ejecutable: highlight.js
    // reparte `&lt;` y `&gt;` entre spans, asi que no se puede buscar
    // `&lt;script&gt;` contiguo.
    const entrada = 'texto con <script>alert(1)</script> y <img onerror="x">';

    for (const ruta of ['guion.md', 'index.html', 'estilos/presentacion.css']) {
      const resultado = highlightCode(ruta, entrada);

      expect(resultado).not.toBeNull();
      expect(resultado).not.toMatch(/<script[\s>]/i);
      expect(resultado).not.toMatch(/<img[\s>]/i);
      // Los unicos `<` sin escapar son los de los `<span>` que abre el propio
      // resaltador; ninguno proviene del texto de entrada.
      expect(resultado!.replace(/<\/?span[^>]*>/g, '')).not.toContain('<');
    }
  });

  /**
   * Las gramaticas son expresiones regulares: tokenizar un archivo enorme
   * podria congelar el renderer. Por encima de la cota se devuelve null y el
   * visor pinta texto plano.
   */
  it('no resalta un archivo desproporcionado', () => {
    const enorme = '<p>a</p>'.repeat(20_000);

    expect(enorme.length).toBeGreaterThan(120_000);
    expect(highlightCode('index.html', enorme)).toBeNull();
  });

  it('devuelve resultado para un archivo dentro de la cota', () => {
    expect(highlightCode('index.html', '<p>ok</p>')).not.toBeNull();
  });
});
