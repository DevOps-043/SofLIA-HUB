import type { OrganizationSettings } from '../../../src/services/org/settings-contract';
let values: OrganizationSettings = {
  name: 'Empresa de prueba', description: 'Un espacio compartido para crear y colaborar.',
  contact_email: 'equipo@example.test', contact_phone: '', website_url: 'https://example.test',
  logo_url: 'https://assets.example.test/logo.svg', brand_favicon_url: '',
  brand_color_primary: '#0A2540', brand_color_secondary: '#00D4B3',
};
// Servicio ficticio: no autentica, consulta ni escribe en ninguna cuenta real.
export async function getOrganizationSettings() { return { ...values }; }
export async function saveOrganizationSettings(_id: string, input: OrganizationSettings, images: { logo?: File; icon?: File } = {}) {
  values = { ...input, logo_url: images.logo ? 'https://assets.example.test/logo.svg' : input.logo_url,
    brand_favicon_url: images.icon ? 'https://assets.example.test/icon.svg' : input.brand_favicon_url };
  return { ...values };
}
