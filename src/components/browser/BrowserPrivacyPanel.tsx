import { useState } from 'react';
import {
  integratedBrowserService,
  type BrowsingDataCategory,
  type BrowsingDataRange,
  type BrowsingDataSummary,
} from '../../services/integrated-browser-service';
import { BrowserConfirmDialog } from './BrowserDialog';

interface CategoryMeta {
  id: BrowsingDataCategory;
  label: string;
  description: string;
  /** True cuando la categoría no puede acotarse al rango elegido. */
  rangeUnaware: boolean;
}

/**
 * Solo el historial admite rango: es nuestro y cada visita guarda su fecha.
 * Cookies y caché viven en Chromium, y Electron no expone su rango temporal, así
 * que se borran completas. La interfaz lo dice en vez de aparentar lo contrario.
 */
const CATEGORIES: CategoryMeta[] = [
  {
    id: 'historial',
    label: 'Historial de navegación',
    description: 'Las páginas que visitaste en este perfil.',
    rangeUnaware: false,
  },
  {
    id: 'cookies',
    label: 'Cookies y datos de sitios',
    description: 'Cerrará tu sesión en la mayoría de los sitios.',
    rangeUnaware: true,
  },
  {
    id: 'cache',
    label: 'Archivos en caché',
    description: 'Algunos sitios cargarán más lento la próxima vez.',
    rangeUnaware: true,
  },
  {
    id: 'contrasenas',
    label: 'Contraseñas guardadas',
    description: 'Se vacía la bóveda cifrada de este perfil.',
    rangeUnaware: true,
  },
  {
    id: 'permisos',
    label: 'Permisos por sitio',
    description: 'Cámara, micrófono, ubicación y el resto vuelven a preguntarse.',
    rangeUnaware: true,
  },
];

const RANGES: Array<{ id: BrowsingDataRange; label: string }> = [
  { id: 'ultima-hora', label: 'Última hora' },
  { id: 'ultimo-dia', label: 'Últimas 24 horas' },
  { id: 'ultima-semana', label: 'Últimos 7 días' },
  { id: 'ultimo-mes', label: 'Últimas 4 semanas' },
  { id: 'todo', label: 'Desde siempre' },
];

const CATEGORY_LABELS: Record<BrowsingDataCategory, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category.label]),
) as Record<BrowsingDataCategory, string>;

export function BrowserPrivacyPanel() {
  const [selected, setSelected] = useState<BrowsingDataCategory[]>(['historial', 'cookies', 'cache']);
  const [range, setRange] = useState<BrowsingDataRange>('todo');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<BrowsingDataSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: BrowsingDataCategory) => {
    setSummary(null);
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  // El aviso solo aparece cuando de verdad hay una discrepancia que explicar.
  const rangeIsPartial = range !== 'todo'
    && selected.some((id) => CATEGORIES.find((category) => category.id === id)?.rangeUnaware);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await integratedBrowserService.clearBrowsingData({ categories: selected, range });
      if (response.success && response.summary) {
        setSummary(response.summary);
        setConfirming(false);
      } else {
        setError(response.error || 'No se pudieron borrar los datos.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron borrar los datos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="browser-privacy-range"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-secondary"
        >
          Intervalo de tiempo
        </label>
        <select
          id="browser-privacy-range"
          value={range}
          onChange={(event) => {
            setSummary(null);
            setRange(event.target.value as BrowsingDataRange);
          }}
          className="soflia-browser-button min-h-10 w-full justify-between px-3 text-[13px]"
        >
          {RANGES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        {CATEGORIES.map((category) => {
          const checked = selected.includes(category.id);
          const showsRangeNote = range !== 'todo' && category.rangeUnaware && checked;

          return (
            <label
              key={category.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition ${
                checked ? 'border-accent/30 bg-accent/[0.06]' : 'border-border hover:bg-surface-2'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(category.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-current"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-primary dark:text-white">{category.label}</span>
                <span className="block text-[11.5px] leading-relaxed text-secondary dark:text-white/60">
                  {category.description}
                </span>
                {showsRangeNote && (
                  <span className="mt-1 block text-[11px] font-medium text-warning">
                    Se borra por completo: el intervalo no aplica a este dato.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {rangeIsPartial && (
        <p className="rounded-2xl border border-warning/25 bg-warning/[0.08] px-3.5 py-2.5 text-[12px] leading-relaxed text-secondary dark:text-white/70">
          El intervalo solo se aplica al historial. Chromium no permite acotar cookies ni caché por
          fecha, así que esas categorías se borran completas.
        </p>
      )}

      <p className="text-[11.5px] leading-relaxed text-secondary dark:text-white/55">
        Solo se borra el perfil de tu sesión. Marcadores y extensiones no se tocan, y los perfiles de
        otras cuentas quedan intactos.
      </p>

      {error && (
        <p role="alert" className="rounded-2xl border border-danger/25 bg-danger/[0.06] px-3.5 py-2.5 text-[12px] text-danger">
          {error}
        </p>
      )}

      {summary && <SummaryList summary={summary} />}

      <div className="flex justify-end">
        <button
          type="button"
          className="soflia-browser-button min-h-9 border-danger/20 bg-danger/[0.06] px-3 text-danger"
          onClick={() => setConfirming(true)}
          disabled={selected.length === 0 || busy}
        >
          Borrar datos
        </button>
      </div>

      {confirming && (
        <BrowserConfirmDialog
          title="Borrar datos de navegación"
          description={describeConfirmation(selected, range)}
          detail="No se puede deshacer. Marcadores, extensiones y los perfiles de otras cuentas no se tocan."
          confirmLabel="Borrar datos"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void run()}
        />
      )}
    </div>
  );
}

function SummaryList({ summary }: { summary: BrowsingDataSummary }) {
  return (
    <div role="status" className="space-y-1 rounded-2xl border border-border bg-surface-2 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">Resultado</p>
      <ul className="space-y-0.5">
        {summary.results.map((result) => (
          <li key={result.category} className="text-[12px] leading-relaxed text-primary dark:text-white/80">
            <span className="font-medium">{CATEGORY_LABELS[result.category]}: </span>
            {describeResult(result)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeResult(result: BrowsingDataSummary['results'][number]): string {
  if (!result.cleared) return `no se pudo borrar (${result.error || 'sin detalle'})`;
  const detail = typeof result.removed === 'number'
    ? `${result.removed} ${result.removed === 1 ? 'elemento' : 'elementos'}`
    : 'borrado';
  return result.ignoredRange ? `${detail}, sin acotar al intervalo` : detail;
}

function describeConfirmation(selected: BrowsingDataCategory[], range: BrowsingDataRange): string {
  const labels = selected.map((id) => CATEGORY_LABELS[id].toLocaleLowerCase()).join(', ');
  const rangeLabel = RANGES.find((item) => item.id === range)?.label.toLocaleLowerCase() ?? 'desde siempre';
  return `Se borrará ${labels} de este perfil (${rangeLabel}).`;
}
