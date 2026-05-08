import type { MeetingTypeDefinition } from './types';

export type RegistryListKey =
  | 'titleKeywords'
  | 'languagePatterns'
  | 'structuralSignals'
  | 'negativeSignals'
  | 'expectedStructure'
  | 'extractionFocus'
  | 'highValueOutputs'
  | 'bestFor'
  | 'commonConfusions'
  | 'confidenceHints'
  | 'secondaryDestinations';

const LIST_KEYS: Record<string, RegistryListKey> = {
  title_keywords: 'titleKeywords',
  language_patterns: 'languagePatterns',
  structural_signals: 'structuralSignals',
  negative_signals: 'negativeSignals',
  expected_structure: 'expectedStructure',
  extraction_focus: 'extractionFocus',
  high_value_outputs: 'highValueOutputs',
  best_for: 'bestFor',
  common_confusions: 'commonConfusions',
  confidence_hints: 'confidenceHints',
  secondary_destinations: 'secondaryDestinations',
};

export function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

export function parseRegistryLine(
  lines: string[],
  index: number,
  trimmed: string,
  current: MeetingTypeDefinition,
  activeList: RegistryListKey | null,
): { index: number; activeList: RegistryListKey | null } {
  if (trimmed.startsWith('display_name:')) return assignScalar(index, null, () => current.displayName = stripQuotes(trimmed.slice('display_name:'.length)));
  if (trimmed.startsWith('cadence:')) return assignScalar(index, null, () => current.cadence = stripQuotes(trimmed.slice('cadence:'.length)));
  if (trimmed.startsWith('duration_expected:')) return assignScalar(index, null, () => current.durationExpected = stripQuotes(trimmed.slice('duration_expected:'.length)));
  if (trimmed.startsWith('purpose:')) return assignMultiline(lines, index, trimmed, 'purpose', current);
  if (trimmed.startsWith('notes:')) return assignMultiline(lines, index, trimmed, 'routingNotes', current);
  if (trimmed.startsWith('default_destination:')) return assignDestination(index, current, trimmed);

  const listKey = LIST_KEYS[trimmed.replace(':', '')];
  if (listKey) return { index, activeList: listKey };

  if (trimmed.startsWith('- ') && activeList) {
    if (activeList !== 'secondaryDestinations') current[activeList].push(stripQuotes(trimmed.slice(2)));
    return { index, activeList };
  }

  return { index, activeList: trimmed.endsWith(':') ? activeList : null };
}

function parsePurposeValue(lines: string[], index: number, initialValue: string): { value: string; nextIndex: number } {
  const baseIndent = lines[index].match(/^\s*/)?.[0].length ?? 0;
  const chunks = [stripQuotes(initialValue)];
  let cursor = index + 1;

  while (cursor < lines.length) {
    const line = lines[cursor];
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (!trimmed) {
      cursor += 1;
      continue;
    }
    if (indent <= baseIndent || trimmed.startsWith('- ') || trimmed.includes(':')) break;
    chunks.push(stripQuotes(trimmed));
    cursor += 1;
  }

  return { value: chunks.filter(Boolean).join(' ').trim(), nextIndex: cursor - 1 };
}

function assignScalar(index: number, activeList: RegistryListKey | null, assign: () => void) {
  assign();
  return { index, activeList };
}

function assignMultiline(lines: string[], index: number, trimmed: string, field: 'purpose' | 'routingNotes', current: MeetingTypeDefinition) {
  const yamlKey = field === 'purpose' ? 'purpose' : 'notes';
  const parsed = parsePurposeValue(lines, index, trimmed.slice(`${yamlKey}:`.length));
  current[field] = parsed.value;
  return { index: parsed.nextIndex, activeList: null };
}

function assignDestination(index: number, current: MeetingTypeDefinition, trimmed: string) {
  const destination = stripQuotes(trimmed.slice('default_destination:'.length));
  current.defaultDestination = ['IRIS', 'Project Hub', 'Team', 'Project', 'None'].includes(destination)
    ? destination as MeetingTypeDefinition['defaultDestination']
    : 'None';
  return { index, activeList: null };
}
