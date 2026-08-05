import { describe, expect, it } from 'vitest';
import { PRIMARY_CHAT_PROMPT } from '../../prompts/chat';

describe('prompt principal: vision del navegador integrado', () => {
  it('PROMPT-BROWSER-001: exige observar la vista compartida antes de describirla', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('## Vision y navegador integrado');
    expect(PRIMARY_CHAT_PROMPT).toContain('inspecciona primero la captura y el DOM adjuntos');
    expect(PRIMARY_CHAT_PROMPT).toContain('usa read_browser_dom antes de considerar Computer Use');
    expect(PRIMARY_CHAT_PROMPT).toContain('misma pagina visible, sesion, cookies e inicios de sesion');
    expect(PRIMARY_CHAT_PROMPT).toContain('no la presentes como una transmision continua de video');
    expect(PRIMARY_CHAT_PROMPT).toContain('el repositorio que me mando Ernesto');
    expect(PRIMARY_CHAT_PROMPT).toContain('no le pidas copiar otra vez lo que ya esta visible');
    expect(PRIMARY_CHAT_PROMPT).toContain('Leer un enlace visible no autoriza escribir');
  });
});
