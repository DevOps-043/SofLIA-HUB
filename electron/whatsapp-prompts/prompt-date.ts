export function formatCurrentDateForPrompt(): string {
  const now = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${dayNames[now.getDay()]} ${now.getDate()} de ${monthNames[now.getMonth()]} de ${now.getFullYear()}, ${hours}:${minutes}`;
}
