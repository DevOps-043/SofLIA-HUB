import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrganizationSettings, saveOrganizationSettings } from '../../../services/org/settings';
import { organizationSettingsSchema, type OrganizationSettings } from '../../../services/org/settings-contract';

export function useOrganizationSettings(organizationId: string, onSaved: (settings: OrganizationSettings) => void) {
  const [values, setValues] = useState<OrganizationSettings | null>(null);
  const [initial, setInitial] = useState<OrganizationSettings | null>(null);
  const [images, setImages] = useState<{ logo?: File; icon?: File }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [generation, setGeneration] = useState(0);
  const [processing, setProcessing] = useState({ logo: false, icon: false });
  const request = useRef({ active: true, revision: 0, busy: false });

  const load = useCallback(() => {
    const scope = request.current;
    if (scope.busy) return;
    const ownRevision = ++scope.revision;
    return getOrganizationSettings(organizationId).then(result => {
      if (!scope.active || ownRevision !== scope.revision) return;
      setValues(result); setInitial(result); setImages({}); setProcessing({ logo: false, icon: false }); setGeneration(value => value + 1);
    }).catch((cause: unknown) => {
      if (scope.active && ownRevision === scope.revision) { setValues(null); setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los ajustes.'); }
    }).finally(() => {
      if (scope.active && ownRevision === scope.revision) setLoading(false);
    });
  }, [organizationId]);

  useEffect(() => {
    const scope = request.current;
    scope.active = true;
    void load();
    return () => { scope.active = false; scope.revision++; };
  }, [load]);

  const reload = () => {
    if (request.current.busy) return;
    setLoading(true); setError(''); setMessage('');
    void load();
  };

  const save = async () => {
    const scope = request.current;
    if (scope.busy || loading || processing.logo || processing.icon || !values) return;
    const parsed = organizationSettingsSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Revisa los campos.'); return; }
    scope.busy = true; setSaving(true); setError(''); setMessage('');
    const ownRevision = ++scope.revision;
    const isCurrent = () => scope.active && scope.revision === ownRevision;
    try {
      const result = await saveOrganizationSettings(organizationId, parsed.data, images, isCurrent);
      if (!isCurrent()) return;
      onSaved(result); setValues(result); setInitial(result); setImages({}); setGeneration(value => value + 1);
      setMessage('Cambios guardados.');
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el guardado.');
    } finally {
      scope.busy = false;
      if (isCurrent()) setSaving(false);
    }
  };

  return { values, loading, saving, error, message, generation, reload, save,
    processing: processing.logo || processing.icon,
    setProcessing: (kind: 'logo' | 'icon', value: boolean) => setProcessing(previous => ({ ...previous, [kind]: value })),
    dirty: JSON.stringify(values) !== JSON.stringify(initial) || Boolean(images.logo || images.icon),
    setField: (key: keyof OrganizationSettings, value: string) => { setValues(previous => previous ? { ...previous, [key]: value } : previous); setMessage(''); },
    setImage: (kind: 'logo' | 'icon', file?: File) => { setImages(previous => ({ ...previous, [kind]: file })); setMessage(''); },
  };
}
