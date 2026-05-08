export function buildOutgoingShareMap(outgoingConversationShares: any[]) {
  const outgoingShareMap = new Map<string, { share_token?: string | null; created_at: string }>();
  for (const share of outgoingConversationShares) {
    const existing = outgoingShareMap.get(share.conversation_id);
    if (!existing || (share.share_token && !existing.share_token)) {
      outgoingShareMap.set(share.conversation_id, {
        share_token: share.share_token ?? null,
        created_at: share.created_at,
      });
    }
  }
  return outgoingShareMap;
}
