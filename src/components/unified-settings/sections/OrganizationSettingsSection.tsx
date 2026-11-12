import type { SofiaContext } from '../../../services/sofia-auth';
import type { SofiaOrganization } from '../../../lib/sofia-client';
import { useAuth } from '../../../contexts/AuthContext';
import { canManageOrganization, type OrganizationSettings } from '../../../services/org/settings-contract';
import { OrganizationImageField } from '../organization/OrganizationImageField';
import { useOrganizationSettings } from '../organization/useOrganizationSettings';
import '../organization/organization-settings.css';

export function OrganizationSettingsSection({ sofiaContext }: { sofiaContext: SofiaContext | null }) {
  const { updateOrganizationProfile } = useAuth();
  if (!canManageOrganization(sofiaContext) || !sofiaContext?.currentOrganization || !sofiaContext.user) {
    return <div className="settings-section-body p-8"><p role="alert">Solo los propietarios y administradores activos pueden configurar esta organización.</p></div>;
  }
  const organization = sofiaContext.currentOrganization;
  const actorId = sofiaContext.user.id;
  return <OrganizationForm key={`${actorId}:${organization.id}`} organization={organization} onSaved={settings => {
    updateOrganizationProfile?.({ ...organization, ...settings, brand_logo_url: settings.logo_url }, actorId);
  }} />;
}

function OrganizationForm({ organization, onSaved }: { organization: SofiaOrganization; onSaved: (settings: OrganizationSettings) => void }) {
  const form = useOrganizationSettings(organization.id, onSaved);
  const fields = [
    ['name', 'Nombre de la organización', 'text', 150],
    ['contact_email', 'Correo de contacto', 'email', 254],
    ['contact_phone', 'Teléfono de contacto', 'tel', 40],
    ['website_url', 'Sitio web', 'url', 2048],
  ] as const;
  return <section className="settings-section flex h-full flex-col overflow-hidden">
    <header className="settings-section-header shrink-0 border-b border-border px-8 pb-5 pt-7">
      <span className="text-xs font-semibold text-accent">Administración</span>
      <h2 className="mt-1 text-2xl font-semibold">Organización</h2>
      <p className="mt-2 text-sm text-secondary">Datos e identidad visual de {organization.name}.</p>
    </header>
    <div className="settings-section-body flex-1 overflow-y-auto p-8">
      {form.loading && <p role="status">Cargando ajustes de la organización…</p>}
      {form.error && <p role="alert" className="mb-4 text-sm text-danger">{form.error}</p>}
      {!form.loading && !form.values && <button type="button" className="settings-primary-action" onClick={() => void form.reload()}>Reintentar</button>}
      {!form.loading && form.values && <form className="organization-settings-form" onSubmit={event => { event.preventDefault(); void form.save(); }}>
        <fieldset disabled={form.saving} className="space-y-7">
          <div>
            <h3 className="mb-4 text-base font-semibold">Datos generales</h3>
            <div className="organization-settings-grid">
              {fields.map(([key, label, type, maxLength]) => <label key={key} className="organization-field">
                <span>{label}</span><input type={type} maxLength={maxLength} required={key === 'name'} value={form.values![key]} onChange={event => form.setField(key, event.target.value)} />
              </label>)}
            </div>
            <label className="organization-field mt-4"><span>Descripción</span><textarea rows={3} maxLength={2000} value={form.values.description} onChange={event => form.setField('description', event.target.value)} /></label>
          </div>
          <div>
            <h3 className="mb-4 text-base font-semibold">Identidad visual</h3>
            <div className="organization-settings-grid" key={form.generation}>
              <OrganizationImageField label="Logo" value={form.values.logo_url} onUrl={value => form.setField('logo_url', value)} onFile={file => form.setImage('logo', file)} onProcessing={value => form.setProcessing('logo', value)} disabled={form.saving} />
              <OrganizationImageField label="Icono" value={form.values.brand_favicon_url} onUrl={value => form.setField('brand_favicon_url', value)} onFile={file => form.setImage('icon', file)} onProcessing={value => form.setProcessing('icon', value)} disabled={form.saving} />
            </div>
            <div className="organization-settings-grid mt-5">
              {(['brand_color_primary', 'brand_color_secondary'] as const).map((key, index) => <div className="organization-field" key={key}>
                <span>{index === 0 ? 'Color principal' : 'Color secundario'}</span>
                <div className="flex gap-2"><input type="color" aria-label={`Elegir ${index === 0 ? 'color principal' : 'color secundario'}`} value={/^#[\da-f]{6}$/i.test(form.values![key]) ? form.values![key] : '#0A2540'} onChange={event => form.setField(key, event.target.value)} /><input type="text" aria-label={`Código del ${index === 0 ? 'color principal' : 'color secundario'}`} value={form.values![key]} placeholder="#0A2540" maxLength={7} onChange={event => form.setField(key, event.target.value)} /></div>
              </div>)}
            </div>
            <p className="mt-3 text-xs text-secondary">Estos colores identifican a la organización y no cambian tu tema personal.</p>
          </div>
        </fieldset>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button type="submit" className="settings-primary-action" disabled={form.saving || form.processing || !form.dirty}>{form.saving ? 'Guardando…' : form.processing ? 'Revisando imagen…' : 'Guardar cambios'}</button>
          <button type="button" className="text-sm text-secondary" disabled={form.saving || !form.dirty} onClick={() => void form.reload()}>Descartar cambios</button>
          {form.message && <span role="status" className="text-sm text-accent">{form.message}</span>}
        </div>
      </form>}
    </div>
  </section>;
}
