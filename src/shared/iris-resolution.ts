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
    if (!variant) continue;

    if (variant === query) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (variant.startsWith(query) || query.startsWith(variant)) {
      bestScore = Math.max(bestScore, 92);
      continue;
    }

    if (variant.includes(query) || query.includes(variant)) {
      bestScore = Math.max(bestScore, 84);
      continue;
    }

    const variantTokens = toTokenSet(variant);
    const overlap = Array.from(queryTokens).filter((token) => variantTokens.has(token)).length;
    if (overlap > 0) {
      const ratio = overlap / Math.max(queryTokens.size, variantTokens.size);
      bestScore = Math.max(bestScore, Math.round(ratio * 78));
    }
  }

  return bestScore;
}

export function resolveSearchCandidate<T>(
  queryInput: string | null | undefined,
  candidates: SearchCandidate<T>[],
  options?: {
    minScore?: number;
    ambiguityWindow?: number;
    maxCandidates?: number;
  },
): SearchResolution<T> {
  const query = normalizeSearchValue(queryInput);
  if (!query) {
    return { match: null, reason: 'empty_query', query, candidates: [] };
  }

  const minScore = options?.minScore ?? 70;
  const ambiguityWindow = options?.ambiguityWindow ?? 8;
  const maxCandidates = options?.maxCandidates ?? 3;

  const ranked = candidates
    .map((candidate) => {
      const variants = Array.from(
        new Set(
          [candidate.label, ...(candidate.aliases || [])]
            .map((value) => normalizeSearchValue(value))
            .filter(Boolean),
        ),
      );

      return {
        candidate,
        score: scoreCandidate(query, variants),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const preview = ranked.slice(0, maxCandidates).map((entry) => ({
    label: entry.candidate.label,
    score: entry.score,
  }));

  if (ranked.length === 0 || ranked[0].score < minScore) {
    return { match: null, reason: 'not_found', query, candidates: preview };
  }

  if (ranked.length > 1 && ranked[1].score >= minScore && ranked[0].score - ranked[1].score < ambiguityWindow) {
    return { match: null, reason: 'ambiguous', query, candidates: preview };
  }

  return {
    match: ranked[0].candidate.item,
    reason: null,
    query,
    candidates: preview,
  };
}

export function describeResolutionCandidates(candidates: SearchResolutionCandidate[]): string {
  return candidates.map((candidate) => candidate.label).join(', ');
}

export function normalizeProjectKey(rawValue: string | null | undefined): string {
  return (rawValue || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16);
}

function buildProjectKeySeed(projectName: string): string {
  const normalized = normalizeSearchValue(projectName).replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);

  if (tokens.length === 0) {
    return 'PROJ';
  }

  if (tokens.length === 1) {
    return tokens[0].toUpperCase().slice(0, 8);
  }

  const initials = tokens.slice(0, 3).map((token) => token.slice(0, 3).toUpperCase()).join('-');
  return normalizeProjectKey(initials) || tokens[0].toUpperCase().slice(0, 8);
}

export function generateUniqueProjectKey(
  projectName: string,
  existingKeys: Iterable<string>,
  preferredKey?: string | null,
): string {
  const usedKeys = new Set(
    Array.from(existingKeys)
      .map((key) => normalizeProjectKey(key))
      .filter(Boolean),
  );

  const preferred = normalizeProjectKey(preferredKey);
  if (preferred && !usedKeys.has(preferred)) {
    return preferred;
  }

  const base = normalizeProjectKey(preferred || buildProjectKeySeed(projectName)) || 'PROJ';
  if (!usedKeys.has(base)) {
    return base;
  }

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `${index}`;
    const trimmedBase = base.slice(0, Math.max(1, 16 - suffix.length - 1));
    const candidate = `${trimmedBase}-${suffix}`;
    if (!usedKeys.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, 12)}-${Date.now().toString().slice(-3)}`;
}
