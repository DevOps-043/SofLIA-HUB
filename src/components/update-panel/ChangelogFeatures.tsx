import { useState } from "react";
import { HubGlyph } from "../ui/HubGlyph";
import SelectDropdown from "../ui/SelectDropdown";
import {
  buildReleaseHistory,
  formatReleaseDate,
  parseNoteSections,
} from "./release-history";

interface ChangelogFeaturesProps {
  currentVersion: string;
  releaseNotes?: string | null;
  newVersion?: string | null;
}

export function ChangelogFeatures({
  currentVersion,
  releaseNotes,
  newVersion,
}: ChangelogFeaturesProps) {
  const entries = buildReleaseHistory(currentVersion, newVersion, releaseNotes);
  const [selection, setSelection] = useState<string | null>(null);
  const selected =
    entries.find(
      (entry) => entry.version === (selection ?? newVersion ?? currentVersion),
    ) ?? entries[0];
  const sections = parseNoteSections(selected.notes);
  return (
    <section
      className="release-history"
      aria-labelledby="release-history-title"
    >
      <div className="release-history-heading">
        <div>
          <span className="settings-eyebrow">Novedades del producto</span>
          <h3 id="release-history-title">Historial de cambios</h3>
        </div>
        <HubGlyph name="history" size={23} />
      </div>
      <div className="release-picker">
        <label htmlFor="release-version">Versión</label>
        <SelectDropdown
          id="release-version"
          value={selected.version}
          onChange={setSelection}
          size="compact"
          className="release-version-select"
          options={entries.map((entry) => ({
            value: entry.version,
            label: 'v' + entry.version + (entry.version === currentVersion ? ' · Instalada' : entry.version === newVersion ? ' · Disponible' : ''),
            description: formatReleaseDate(entry.date) ?? 'Notas de esta versión',
          }))}
        />
      </div>
      <article className="release-entry settings-enter" key={selected.version}>
        <header>
          <h4>v{selected.version}</h4>
          <span className="settings-tag">
            {selected.version === currentVersion
              ? "Instalada"
              : selected.version === newVersion
                ? "Disponible"
                : "Publicada"}
          </span>
          {formatReleaseDate(selected.date) && (
            <time dateTime={selected.date ?? undefined}>
              {formatReleaseDate(selected.date)}
            </time>
          )}
        </header>
        {sections.length ? (
          sections.map((section, index) => (
            <section key={index} className="release-note-group">
              <h5>{section.title}</h5>
              <ul>
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="release-empty">
            <HubGlyph name="files" size={28} />
            <p>No hay notas publicadas para esta versión.</p>
            <span>
              Las notas aparecerán cuando estén disponibles en la publicación.
            </span>
          </div>
        )}
      </article>
    </section>
  );
}
