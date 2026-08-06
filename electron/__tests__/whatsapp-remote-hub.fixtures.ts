export const dangerousPatterns = [
  'rm -rf /',
  'del /S /Q C:\\',
  'format C:',
  'mkfs.ext4 /dev/sda1',
  'dd if=/dev/zero of=/dev/sda',
  'chmod -R 777 /',
  'chown -R root:root /',
  'sudo rm -rf /home',
  '> /dev/sda',
];

export const commandInjections = [
  'echo hola && rm -rf /',
  'ls; sudo rm -rf /tmp',
  'cat archivo.txt | dd if=/dev/zero of=/dev/sda',
  'whoami; chmod -R 777 /etc',
  'echo test; mkfs /dev/sda1',
];

export function hasSecurityError(result: any): boolean {
  return result.error.issues.some(
    (error: any) => error.message.includes('bloqueado') || error.message.includes('Patron peligroso') || error.message.includes('Patr'),
  );
}
