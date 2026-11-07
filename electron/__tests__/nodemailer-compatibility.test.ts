import net from 'node:net';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';

describe('Compatibilidad Nodemailer real', () => {
  it('mantiene exports CJS/ESM y compositor con BCC', async () => {
    const requireCjs = createRequire(import.meta.url);
    const cjs: typeof nodemailer = requireCjs('nodemailer');
    expect(typeof cjs.createTransport).toBe('function');
    expect(typeof nodemailer.createTransport).toBe('function');
    const Composer = (await import('nodemailer/lib/mail-composer')).default;
    const mime = new Composer({ to: 'a@example.test', bcc: 'b@example.test', subject: 'Asunto', text: 'Contenido' }).compile();
    mime.keepBcc = true;
    expect((await mime.build()).toString()).toContain('Bcc: b@example.test');
  });

  it('verifica SMTP, autenticación ficticia, bytes y sobre BCC en servidor local', async () => {
    const sockets = new Set<net.Socket>();
    const recipients: string[] = [];
    const messages: string[] = [];
    let authentications = 0;
    const server = net.createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      socket.write('220 localhost ESMTP prueba\r\n');
      let buffer = '', data = false, message = '';
      socket.on('data', chunk => {
        buffer += chunk.toString();
        while (buffer.includes('\r\n')) {
          const at = buffer.indexOf('\r\n');
          const line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
          if (data) {
            if (line === '.') { messages.push(message); data = false; socket.write('250 aceptado-prueba\r\n'); }
            else message += line + '\r\n';
          } else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 PIPELINING\r\n');
          else if (/^AUTH PLAIN /.test(line)) {
            const valid = Buffer.from(line.slice('AUTH PLAIN '.length), 'base64').toString() === '\0prueba@example.test\0credencial-ficticia';
            if (valid) authentications++;
            socket.write(valid ? '235 autenticado\r\n' : '535 denegado\r\n');
          }
          else if (/^RCPT TO:/.test(line)) { recipients.push(line); socket.write('250 OK\r\n'); }
          else if (line === 'DATA') { data = true; socket.write('354 continuar\r\n'); }
          else if (line === 'QUIT') { socket.end('221 adiós\r\n'); }
          else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Puerto de prueba no disponible');
    const transport = nodemailer.createTransport({ host: '127.0.0.1', port: address.port, secure: false, ignoreTLS: true,
      auth: { user: 'prueba@example.test', pass: 'credencial-ficticia' },
      connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000 });
    try {
      expect(await transport.verify()).toBe(true);
      const result = await transport.sendMail({ from: 'origen@example.test', to: 'destino@example.test', bcc: 'oculto@example.test',
        subject: 'Prueba local', text: 'Contenido de prueba', attachments: [{ filename: 'datos.txt', content: Buffer.from('archivo completo') }] });
      expect(result.accepted).toEqual(['destino@example.test', 'oculto@example.test']);
      expect(authentications).toBe(2);
      expect(recipients).toHaveLength(2); expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(Buffer.from('archivo completo').toString('base64'));
      expect(messages[0]).not.toContain('Bcc:');
    } finally {
      transport.close(); for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
