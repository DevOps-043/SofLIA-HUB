import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { semillaCoincide } = await import(/* @vite-ignore */ pathToFileURL(resolve('scripts/quality/system-skills-seed.mjs')).href);
const seed = '-- <<< SEMILLA GENERADA\nINSERT INTO public.system_skills VALUES ($semilla$contenido$semilla$);\n-- SEMILLA GENERADA >>>';

describe('comparación de la semilla del catálogo', () => {
  it.each(['LF', 'CRLF', 'mixto'])('acepta el mismo contenido con finales %s', ending => {
    const actual = ending === 'CRLF' ? seed.replace(/\n/g, '\r\n') : ending === 'mixto' ? seed.replace('\n', '\r\n') : seed;
    expect(semillaCoincide(`-- cabecera\n${actual}\n-- pie`, seed)).toBe(true);
  });
  it('normaliza también el lado esperado sin quitar espacios del contenido', () => {
    expect(semillaCoincide(seed, seed.replace(/\n/g, '\r\n'))).toBe(true);
    expect(semillaCoincide(seed.replace('contenido', 'contenido '), seed)).toBe(false);
  });
  it.each(['contenido distinto', 'herramienta_adicional', '', 'contenido\r'])('rechaza un cambio real: %s', content => {
    expect(semillaCoincide(seed.replace('contenido', content), seed)).toBe(false);
  });
  it.each(['', '-- <<< SEMILLA GENERADA', '-- SEMILLA GENERADA >>>\n-- <<< SEMILLA GENERADA'])('rechaza marcas ausentes o invertidas: %s', content => {
    expect(semillaCoincide(content, seed)).toBe(false);
  });
});
