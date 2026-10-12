import { describe, expect, it } from 'vitest';
import { highlightChatCode } from '../../components/chat/markdown-renderer/code-highlight';

describe('Colores del código del chat', () => {
  it.each(['bat', 'cmd', 'batch', 'dos', 'BAT', 'language-bat'])('resalta comandos de Windows con %s', (language) => {
    const html = highlightChatCode(language, '@echo off\nsetlocal\nnet user "%USERNAME%" *\nif errorlevel 1 (\n  pause\n)');
    expect(html).toContain('hljs-built_in');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-variable');
  });

  it.each(['powershell', 'ps1', 'pwsh'])('resalta PowerShell con %s', (language) => {
    expect(highlightChatCode(language, '$name = "SoflIA"\nWrite-Host $name')).toContain('hljs-variable');
  });

  it.each([
    ['bash', 'echo "$HOME"'], ['js', 'const answer = 42;'], ['ts', 'const answer: number = 42;'],
    ['python', 'print("Hola")'], ['json', '{"answer": 42}'], ['sql', 'SELECT id FROM usuarios'],
    ['html', '<p>Hola</p>'], ['css', '.chat { color: red; }'], ['yaml', 'name: SoflIA'],
  ])('admite %s', (language, code) => {
    expect(highlightChatCode(language, code)).toContain('class="hljs-');
  });

  it.each(['', 'text', 'plaintext', 'prompt', 'markdown', 'md', 'desconocido'])('mantiene %s sin resaltado', (language) => {
    expect(highlightChatCode(language, '<script>alert(1)</script>')).toBeNull();
  });

  it('escapa contenido ejecutable y conserva el texto exacto', () => {
    const code = '\n\n  echo <img src=x onerror=alert(1)> & "texto"\n';
    for (const language of ['cmd', 'powershell', 'js', 'html']) {
      const html = highlightChatCode(language, code)!;
      const element = document.createElement('code');
      element.innerHTML = html;
      expect(element.querySelector('img, script')).toBeNull();
      expect(element.textContent).toBe(code);
      expect(html.replace(/<\/?span[^>]*>/g, '')).not.toContain('<');
    }
  });

  it('evita tokenizar bloques por encima de la cota', () => {
    expect(highlightChatCode('bat', 'echo hola\n'.repeat(15_000))).toBeNull();
  });
});
