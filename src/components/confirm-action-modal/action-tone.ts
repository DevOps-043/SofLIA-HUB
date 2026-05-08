export function getActionTone(toolName: string) {
  const isDestructive = toolName === 'delete_item';
  const isEmail = toolName === 'send_email';

  if (isDestructive) {
    return {
      accentGradient: 'bg-gradient-to-r from-red-500 to-red-400',
      confirmBtnClass: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
      confirmLabel: 'Eliminar',
    };
  }

  if (isEmail) {
    return {
      accentGradient: 'bg-gradient-to-r from-blue-500 to-blue-400',
      confirmBtnClass: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20',
      confirmLabel: 'Enviar',
    };
  }

  return {
    accentGradient: 'bg-gradient-to-r from-amber-500 to-amber-400',
    confirmBtnClass: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
    confirmLabel: 'Ejecutar',
  };
}
