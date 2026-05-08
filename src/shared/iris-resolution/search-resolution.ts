export interface SearchCandidate<T> {
  item: T;
  label: string;
  aliases?: Array<string | null | undefined>;
}

export interface SearchResolutionCandidate {
  label: string;
  score: number;
}

export interface SearchResolution<T> {
  match: T | null;
  reason: 'empty_query' | 'not_found' | 'ambiguous' | null;
  query: string;
  candidates: SearchResolutionCandidate[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeSearchValue(value: string | null | undefined): string {
  return normalizeWhitespace(
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9@._\s-]/g, ' '),
  );
}

function toTokenSet(value: string): Set<string> {
  return new Set(value.split(' ').filter(Boolean));
}

function scoreCandidate(query: string, variants: string[]): number {
  if (!query) return 0;
  const queryTokens = toTokenSet(query);
  let bestScore = 0;

  for (const variant of variants) {
    bestScore = Math.max(bestScore, scoreVariant(query, queryTokens, variant));
  }

  return bestScore;
}

function scoreVariant(query: string, queryTokens: Set<string>, variant: string): number {
  if (!variant) return 0;
  if (variant === query) return 100;
  if (variant.startsWith(query) || query.startsWith(variant)) return 92;
  if (variant.includes(query) || query.includes(variant)) return 84;

  const variantTokens = toTokenSet(variant);
  const overlap = Array.from(queryTokens).filter((token) => variantTokens.has(token)).length;
  return overlap > 0 ? Math.round((overlap / Math.max(queryTokens.size, variantTokens.size)) * 78) : 0;
}

export function resolveSearchCandidate<T>(
  queryInput: string | null | undefined,
  candidates: SearchCandidate<T>[],
  options?: { minScore?: number; ambiguityWindow?: number; maxCandidates?: number },
): SearchResolution<T> {
  const query = normalizeSearchValue(queryInput);
  if (!query) return { match: null, reason: 'empty_query', query, candidates: [] };

  const minScore = options?.minScore ?? 70;
  const ambiguityWindow = options?.ambiguityWindow ?? 8;
  const maxCandidates = options?.maxCandidates ?? 3;
  const ranked = rankCandidates(query, candidates);
  const preview = ranked.slice(0, maxCandidates).map((entry) => ({ label: entry.candidate.label, score: entry.score }));

  if (ranked.length === 0 || ranked[0].score < minScore) {
    return { match: null, reason: 'not_found', query, candidates: preview };
  }
  if (ranked.length > 1 && ranked[1].score >= minScore && ranked[0].score - ranked[1].score < ambiguityWindow) {
    return { match: null, reason: 'ambiguous', query, candidates: preview };
  }

  return { match: ranked[0].candidate.item, reason: null, query, candidates: preview };
}

function rankCandidates<T>(query: string, candidates: SearchCandidate<T>[]) {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(query, getVariants(candidate)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

function getVariants<T>(candidate: SearchCandidate<T>): string[] {
  return Array.from(new Set([candidate.label, ...(candidate.aliases || [])].map((value) => normalizeSearchValue(value)).filter(Boolean)));
}

export function describeResolutionCandidates(candidates: SearchResolutionCandidate[]): string {
  return candidates.map((candidate) => candidate.label).join(', ');
}
