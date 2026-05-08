import type { MeetingTypeDefinition } from './types';
import { parseRegistryLine, stripQuotes, type RegistryListKey } from './parser-line';

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

export function parseMeetingTypeRegistry(raw: string): MeetingTypeDefinition[] {
  const lines = raw.split(/\r?\n/);
  const meetingTypes: MeetingTypeDefinition[] = [];
  let current: MeetingTypeDefinition | null = null;
  let activeList: RegistryListKey | null = null;

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

    const nextIndex = parseRegistryLine(lines, index, trimmed, current, activeList);
    activeList = nextIndex.activeList;
    index = nextIndex.index;
  }

  if (current) meetingTypes.push(current);
  return meetingTypes;
}

export function parseThreshold(raw: string, expression: RegExp, fallback: number): number {
  const match = raw.match(expression);
  if (!match?.[1]) return fallback;
  const nextValue = Number.parseFloat(match[1]);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}
