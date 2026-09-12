import type { BrowserTabGroupColor } from '../../services/integrated-browser-service';

export const GROUP_COLORS: Record<BrowserTabGroupColor, { label: string; hex: string }> = {
  grey: { label: 'Gris', hex: '#64748b' }, blue: { label: 'Azul', hex: '#2563eb' },
  red: { label: 'Rojo', hex: '#dc2626' }, yellow: { label: 'Amarillo', hex: '#ca8a04' },
  green: { label: 'Verde', hex: '#16a34a' }, pink: { label: 'Rosa', hex: '#db2777' },
  purple: { label: 'Morado', hex: '#9333ea' }, cyan: { label: 'Cian', hex: '#0891b2' },
};
