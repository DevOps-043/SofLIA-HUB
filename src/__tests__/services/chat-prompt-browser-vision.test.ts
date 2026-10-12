import { describe, expect, it } from 'vitest';
import { PRIMARY_CHAT_PROMPT } from '../../prompts/chat';

describe('prompt principal: vision del navegador integrado', () => {
  it('PROMPT-BROWSER-001: exige observar la vista compartida antes de describirla', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('## Vision y navegador integrado');
    expect(PRIMARY_CHAT_PROMPT).toContain('inspecciona primero la captura y el DOM adjuntos');
    expect(PRIMARY_CHAT_PROMPT).toContain('capturar_vista_navegador para obtener un cuadro nuevo');
    expect(PRIMARY_CHAT_PROMPT).toContain('misma pagina visible, sesion, cookies e inicios de sesion');
    expect(PRIMARY_CHAT_PROMPT).toContain('no la presentes como una transmision continua de video');
    expect(PRIMARY_CHAT_PROMPT).toContain('el repositorio que me mando Ernesto');
    expect(PRIMARY_CHAT_PROMPT).toContain('no le pidas copiar otra vez lo que ya esta visible');
    expect(PRIMARY_CHAT_PROMPT).toContain('Leer un enlace visible no autoriza escribir');
  });

  it('PROMPT-BROWSER-002: distingue la evidencia por captura de la entrada de video real', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('Cuando la evidencia del turno son CAPTURAS');
    expect(PRIMARY_CHAT_PROMPT).toContain('Cuando el turno envio VIDEO de verdad');
    expect(PRIMARY_CHAT_PROMPT).toContain('declara el intervalo que analizaste');
  });

  it('PROMPT-BROWSER-003: prohibe pedir la transcripcion teniendo la ruta de video', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('no pidas que abran la transcripcion de un video');
    expect(PRIMARY_CHAT_PROMPT).toContain('usa analizar_video_pestana; nunca pidas abrir la transcripcion');
  });

  it('PROMPT-BROWSER-004: prohibe describir evidencia que no llego al turno', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('contenido-protegido');
    expect(PRIMARY_CHAT_PROMPT).toContain('Nunca describas una escena, una persona, un texto o un sonido que no llego en este turno');
    expect(PRIMARY_CHAT_PROMPT).toContain('Es preferible decir "no puedo verlo" a inventar');
  });

  it('PROMPT-BROWSER-005: exige declarar cuando la evidencia es un muestreo', () => {
    expect(PRIMARY_CHAT_PROMPT).toContain('Si la evidencia es un MUESTREO de cuadros y no el video, dilo al responder');
  });
});
