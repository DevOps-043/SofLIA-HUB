import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { getRemoteNodeHostStatus, listRemoteNodes, type RemoteNodeHostStatus, type RemoteNodeRecord } from '../../../services/remote-node-service';

/** Caché local ligada a identidad; no concede autorización, que se verifica en main. */
export function useRemoteNodeData(owner: string) {
  const identity = useMemo(() => ({ owner }), [owner]);
  const lease = useRef<{ identity: typeof identity } | null>(null);
  const [cache, setCache] = useState<{ identity: typeof identity; host: RemoteNodeHostStatus | null; nodes: RemoteNodeRecord[] } | null>(null);
  if (cache && cache.identity !== identity) setCache(null);
  useLayoutEffect(() => {
    lease.current = { identity };
    return () => { lease.current = null; };
  }, [identity]);
  const refresh = useCallback(async () => {
    const current = lease.current;
    if (!owner || current?.identity !== identity) return;
    const [host, result] = await Promise.all([getRemoteNodeHostStatus(), listRemoteNodes()]);
    if (lease.current !== current) return;
    if (!result.success) throw new Error(result.error || 'No pude cargar nodos.');
    setCache({ identity, host, nodes: result.nodes || [] });
  }, [identity, owner]);
  const setHostStatus = useCallback((value: SetStateAction<RemoteNodeHostStatus | null>) => {
    const current = lease.current;
    if (current?.identity !== identity) return;
    setCache(previous => {
      if (lease.current !== current) return previous;
      const prior = previous?.identity === identity ? previous : null;
      return { identity, host: typeof value === 'function' ? value(prior?.host ?? null) : value, nodes: prior?.nodes ?? [] };
    });
  }, [identity]);
  return { hostStatus: cache?.identity === identity ? cache.host : null,
    nodes: cache?.identity === identity ? cache.nodes : [], setHostStatus, refresh };
}
