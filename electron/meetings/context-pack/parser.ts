import type { MeetingTypeDefinition } from './types';
import { LIST_KEYS, type ListKey } from './parser-keys';

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

function createMeetingType(id: string): MeetingTypeDefinition {
  return {
    id,
    displayName: '',
    purpose: '',
    bestFor: [],
    cadence: 'unknown',
    durationExpected: 'unknown',
    titleKeywords: [],
    languagePatterns: [],
    structuralSignals: [],
    negativeSignals: [],
    expectedStructure: [],
    extractionFocus: [],
    highValueOutputs: [],
    defaultDestination: 'None',
    routingNotes: '',
    commonConfusions: [],
    confidenceHints: [],
  };
}

function parseMultilineValue(lines: string[], index: number, initialValue: string) {
  const baseIndent = lines[index].match(/^\s*/)?.[0].length ?? 0;
  const chunks = [stripQuotes(initialValue)];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (!trimmed) cursor += 1;
    else if (indent <= baseIndent || trimmed.startsWith('- ') || trimmed.includes(':')) break;
    else {
      chunks.push(stripQuotes(trimmed));
      cursor += 1;
    }
  }
  return { value: chunks.filter(Boolean).join(' ').trim(), nextIndex: cursor - 1 };
}

export function parseMeetingTypeRegistry(raw: string): MeetingTypeDefinition[] {
  const meetingTypes: MeetingTypeDefinition[] = [];
  const lines = raw.split(/\r?\n/);
  let current: MeetingTypeDefinition | null = null;
  let activeList: ListKey | 'secondaryDestinations' | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed === 'meeting_types:') continue;
    if (trimmed.startsWith('- id:')) {
      if (current) meetingTypes.push(current);
      current = createMeetingType(stripQuotes(trimmed.slice('- id:'.length)));
      activeList = null;
      continue;
    }
    if (!current) continue;

    const [rawKey, ...valueParts] = trimmed.split(':');
    const key = rawKey as keyof typeof LIST_KEYS;
    const value = valueParts.join(':');
    if (key in LIST_KEYS && !value) {
      activeList = LIST_KEYS[key];
    } else if (trimmed === 'secondary_destinations:') {
      activeList = 'secondaryDestinations';
    } else if (trimmed.startsWith('- ') && activeList && activeList !== 'secondaryDestinations') {
      current[activeList].push(stripQuotes(trimmed.slice(2)));
    } else if (trimmed.startsWith('display_name:')) {
      current.displayName = stripQuotes(value);
      activeList = null;
    } else if (trimmed.startsWith('purpose:') || trimmed.startsWith('notes:')) {
      const parsed = parseMultilineValue(lines, index, value);
      if (trimmed.startsWith('purpose:')) current.purpose = parsed.value;
      else current.routingNotes = parsed.value;
      index = parsed.nextIndex;
      activeList = null;
    } else if (trimmed.startsWith('cadence:')) current.cadence = stripQuotes(value);
    else if (trimmed.startsWith('duration_expected:')) current.durationExpected = stripQuotes(value);
    else if (trimmed.startsWith('default_destination:')) {
      const destination = stripQuotes(value);
      current.defaultDestination = ['IRIS', 'Project Hub', 'Team', 'Project', 'None'].includes(destination)
        ? destination as MeetingTypeDefinition['defaultDestination']
        : 'None';
      activeList = null;
    } else if (!trimmed.endsWith(':')) activeList = null;
  }

  if (current) meetingTypes.push(current);
  return meetingTypes;
}

export function parseThreshold(raw: string, expression: RegExp, fallback: number): number {
  const nextValue = Number.parseFloat(raw.match(expression)?.[1] || '');
  return Number.isFinite(nextValue) ? nextValue : fallback;
}
