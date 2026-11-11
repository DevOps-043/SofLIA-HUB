export function getActionTone(toolName: string) {
  const isDestructive = toolName === 'delete_item';
  const isEmail = toolName === 'send_email';

  if (isDestructive) {
    return {
      accentGradient: 'bg-gradient-to-r from-red-500 to-red-400',
      confirmBtnClass: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
      confirmLabel: 'Eliminar',
    };
  }

  if (isEmail) {
    return {
      accentGradient: 'bg-gradient-to-r from-blue-500 to-blue-400',
      confirmBtnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
      confirmLabel: 'Enviar',
    };
  }

  return {
    accentGradient: 'bg-gradient-to-r from-amber-500 to-amber-400',
    confirmBtnClass: 'bg-amber-700 hover:bg-amber-800 shadow-amber-500/20',
    confirmLabel: 'Ejecutar',
  };
}
