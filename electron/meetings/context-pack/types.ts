export interface MeetingTypeDefinition {
  id: string;
  displayName: string;
  purpose: string;
  bestFor: string[];
  cadence: string;
  durationExpected: string;
  titleKeywords: string[];
  languagePatterns: string[];
  structuralSignals: string[];
  negativeSignals: string[];
  expectedStructure: string[];
  extractionFocus: string[];
  highValueOutputs: string[];
  defaultDestination: 'IRIS' | 'Project Hub' | 'Team' | 'Project' | 'None';
  routingNotes: string;
  commonConfusions: string[];
  confidenceHints: string[];
}

export interface MeetingContextPack {
  rootAgents: string;
  packAgents: string;
  meetingTypeRegistryRaw: string;
  extractionRulesRaw: string;
  outputSchema: Record<string, unknown>;
  outputSchemaRaw: string;
  promptMaster: string;
  sourceTraceability?: string;
  implementationNotes?: string;
  rootReadme?: string;
  packReadme?: string;
  manifest?: string;
  meetingTypes: MeetingTypeDefinition[];
  fallbackThreshold: number;
  reducedAggressivenessUpper: number;
  missingFiles: string[];
}

export interface ContextPackFileMap {
  rootAgents: string;
  packAgents: string;
  meetingTypeRegistryRaw: string;
  extractionRulesRaw: string;
  outputSchemaRaw: string;
  promptMaster: string;
  sourceTraceability?: string;
  implementationNotes?: string;
  rootReadme?: string;
  packReadme?: string;
  manifest?: string;
}

export interface LoadedContextPackFiles extends ContextPackFileMap {
  missingFiles: string[];
}
