export const LIST_KEYS = {
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
} as const;

export type ListKey = (typeof LIST_KEYS)[keyof typeof LIST_KEYS];
