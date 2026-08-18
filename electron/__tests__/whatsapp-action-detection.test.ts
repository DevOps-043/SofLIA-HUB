import { describe, expect, it } from 'vitest';
import { detectActionRequest } from '../whatsapp-prompts/action-detection';

/**
 * De esta deteccion depende que el agente pueda usar herramientas: con `false`,
 * `guardUnrequestedOperationalTools` las bloquea todas y el agente contesta
 * explicando como hacerlo a mano en vez de ejecutarlo.
 */
describe('detectActionRequest', () => {
  it('reconoce ordenes sobre la app y el sistema en forma cortes', () => {
    // Caso real reportado: el agente explicaba como activar el orbe a mano
    // porque "activar" no estaba en la lista de verbos.
    expect(detectActionRequest('Puedes activar el modo orbe en la computadora?')).toBe(true);
    expect(detectActionRequest('Puedes reiniciar el servicio?')).toBe(true);
    expect(detectActionRequest('Podrias cerrar esa aplicacion?')).toBe(true);
    expect(detectActionRequest('Me ayudas a instalar el programa?')).toBe(true);
  });

  it('reconoce las mismas ordenes en imperativo', () => {
    expect(detectActionRequest('Activa el modo orbe')).toBe(true);
    expect(detectActionRequest('Desactiva las notificaciones')).toBe(true);
    expect(detectActionRequest('Muestrame los archivos de la carpeta')).toBe(true);
    expect(detectActionRequest('Ejecuta el respaldo')).toBe(true);
  });

  it('conserva lo que ya detectaba', () => {
    expect(detectActionRequest('organiza mis archivos')).toBe(true);
    expect(detectActionRequest('Puedes crear una presentacion de ventas?')).toBe(true);
    expect(detectActionRequest('Ayudame a investigar el capitulo 5 del CCNA')).toBe(true);
    expect(detectActionRequest('Envia el reporte por correo')).toBe(true);
  });

  it('no convierte conversacion social en accion operativa', () => {
    expect(detectActionRequest('Puedes platicar conmigo un rato?')).toBe(false);
    expect(detectActionRequest('Hola')).toBe(false);
    expect(detectActionRequest('Como estas?')).toBe(false);
    expect(detectActionRequest('Gracias!')).toBe(false);
  });

  it('ignora los acentos al normalizar', () => {
    expect(detectActionRequest('¿Puedes activar el modo orbe?')).toBe(true);
    expect(detectActionRequest('Podrías reiniciarlo')).toBe(true);
  });
});
