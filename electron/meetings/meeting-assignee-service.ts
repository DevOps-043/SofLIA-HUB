export interface MeetingAssignableUser {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

function normalizeValue(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@._\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toVariants(user: MeetingAssignableUser): string[] {
  const values = [
    user.display_name,
    user.username,
    user.email,
    user.email?.split('@')[0] || null,
  ];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeValue(value))
        .filter(Boolean),
    ),
  );
}

function scoreCandidate(candidate: string, variants: string[]): number {
  if (!candidate) return 0;

  const candidateTokens = candidate.split(' ').filter(Boolean);
  let bestScore = 0;

  for (const variant of variants) {
    if (!variant) continue;
    if (variant === candidate) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }
    if (variant.startsWith(candidate) || candidate.startsWith(variant)) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }
    if (variant.includes(candidate) || candidate.includes(variant)) {
      bestScore = Math.max(bestScore, 80);
      continue;
    }

    const variantTokens = variant.split(' ').filter(Boolean);
    const overlap = candidateTokens.filter((token) => variantTokens.includes(token)).length;
    if (overlap > 0) {
      const tokenScore = Math.round((overlap / Math.max(candidateTokens.length, variantTokens.length)) * 70);
      bestScore = Math.max(bestScore, tokenScore);
    }
  }

  return bestScore;
}

export class MeetingAssigneeService {
  resolveAssigneeId(candidate: string | null | undefined, members: MeetingAssignableUser[]): string | null {
    const normalizedCandidate = normalizeValue(candidate);
    if (!normalizedCandidate || members.length === 0) {
      return null;
    }

    let bestMatch: { userId: string; score: number } | null = null;

    for (const member of members) {
      const score = scoreCandidate(normalizedCandidate, toVariants(member));
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { userId: member.user_id, score };
      }
    }

    if (!bestMatch || bestMatch.score < 70) {
      return null;
    }

    return bestMatch.userId;
  }
}
