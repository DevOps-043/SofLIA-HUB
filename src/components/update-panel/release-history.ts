import changelog from "../../../CHANGELOG.md?raw";
import { toSafeReleaseNotesText } from "../update-notes/SafeReleaseNotes";

export interface ReleaseEntry {
  version: string;
  date: string | null;
  notes: string;
}
export interface ReleaseSection {
  title: string;
  items: string[];
}
const VERSION_HEADING =
  /^## \[?(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?:\])?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/;

/** Una sola fuente de notas para la UI y el workflow de publicación. */
export function parseChangelog(source: string): ReleaseEntry[] {
  const entries: ReleaseEntry[] = [];
  let current: ReleaseEntry | null = null;
  for (const line of source
    .slice(0, 500_000)
    .replace(/\r\n/g, "\n")
    .split("\n")) {
    if (/^## /.test(line)) {
      const match = line.match(VERSION_HEADING);
      current = match
        ? { version: match[1], date: match[2] ?? null, notes: "" }
        : null;
      if (current) entries.push(current);
    } else if (current) current.notes += line + "\n";
  }
  return entries.map((entry) => ({ ...entry, notes: entry.notes.trim() }));
}

export function buildReleaseHistory(
  currentVersion: string,
  availableVersion?: string | null,
  incomingNotes?: string | null,
  source = changelog,
): ReleaseEntry[] {
  const entries = parseChangelog(source);
  if (availableVersion && incomingNotes?.trim()) {
    const incoming = parseChangelog(incomingNotes)[0];
    const entry: ReleaseEntry = {
      version: availableVersion,
      date: incoming?.version === availableVersion ? incoming.date : null,
      notes:
        incoming?.version === availableVersion
          ? incoming.notes
          : incomingNotes.slice(0, 32_000),
    };
    const index = entries.findIndex(
      (candidate) => candidate.version === availableVersion,
    );
    if (index >= 0)
      entries[index] = {
        ...entries[index],
        ...entry,
        date: entry.date ?? entries[index].date,
      };
    else entries.unshift(entry);
  }
  if (availableVersion && !entries.some((entry) => entry.version === availableVersion))
    entries.unshift({ version: availableVersion, date: null, notes: "" });
  if (!entries.some((entry) => entry.version === currentVersion))
    entries.unshift({ version: currentVersion, date: null, notes: "" });
  return entries.filter(
    (entry, index) =>
      entries.findIndex((candidate) => candidate.version === entry.version) ===
      index,
  );
}

export function parseNoteSections(notes: string): ReleaseSection[] {
  const sections: ReleaseSection[] = [];
  let section: ReleaseSection = { title: "Detalles", items: [] };
  const pushSection = () => {
    if (section.items.length) sections.push(section);
  };
  for (const line of toSafeReleaseNotesText(notes).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const title = trimmed.match(/^#{1,6}\s+(.+)/);
    if (title) {
      pushSection();
      section = { title: title[1], items: [] };
      continue;
    }
    const item = trimmed.match(/^[-*•]\s+(.+)/);
    if (item) section.items.push(item[1].replace(/\*\*/g, ""));
    else if (section.items.length)
      section.items[section.items.length - 1] +=
        " " + trimmed.replace(/\*\*/g, "");
    else section.items.push(trimmed.replace(/\*\*/g, ""));
  }
  pushSection();
  return sections;
}

export function formatReleaseDate(date: string | null): string | null {
  if (!date) return null;
  const value = new Date(date + "T12:00:00Z");
  return Number.isNaN(value.getTime())
    ? null
    : new Intl.DateTimeFormat("es", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(value);
}
